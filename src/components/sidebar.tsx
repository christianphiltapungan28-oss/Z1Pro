"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { Journey } from "@/types/journey";
import {
  BookIcon,
  ChatSparkIcon,
  ChevronRightIcon,
  CloseIcon,
  HomeIcon,
  LogoutIcon,
  PinIcon,
  SettingsIcon,
  SparkleIcon,
  StacksIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/icons";

type OrgSummary = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isDefault: boolean;
};

type View = "home" | "journeys";

const navItems: {
  label: string;
  icon: typeof HomeIcon;
  view: View;
  requiresAuth: boolean;
}[] = [
  { label: "Home", icon: HomeIcon, view: "home", requiresAuth: false },
  { label: "Journeys", icon: StacksIcon, view: "journeys", requiresAuth: true },
];

type Conversation = {
  id: string;
  title: string | null;
  pinned: boolean;
  lastMessageAt: string | null;
  createdAt: string;
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function ProfileAvatar({
  image,
  name,
  authenticated,
}: {
  image?: string | null;
  name: string;
  authenticated: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (image && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        onError={() => setImageFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong font-display text-sm font-semibold text-white">
      {authenticated ? initials(name) : "?"}
    </div>
  );
}

function ChatRow({
  conversation,
  active,
  onSelect,
  onTogglePin,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-sidebar-fg/90 transition-colors hover:bg-sidebar-fg/5 ${
        active ? "bg-sidebar-fg/10" : ""
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm">{conversation.title || "New chat"}</p>
        <p className="text-[11px] text-sidebar-muted">
          {formatRelativeTime(
            conversation.lastMessageAt ?? conversation.createdAt
          )}
        </p>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={`${conversation.pinned ? "Unpin" : "Pin"} chat: ${conversation.title || "New chat"}`}
        aria-pressed={conversation.pinned}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
          conversation.pinned
            ? "text-accent"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-sidebar-fg [@media(hover:none)]:opacity-100"
        }`}
      >
        <PinIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete chat: ${conversation.title || "New chat"}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-0 transition-colors hover:text-sidebar-fg group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  view,
  onChangeView,
  onOpenAppearance,
  onRequireAuth,
  onOpenUpgrade,
  onOpenOrganization,
  activeConversationId,
  onSelectConversation,
  journeys,
}: {
  open: boolean;
  onClose: () => void;
  view: View;
  onChangeView: (view: View) => void;
  onOpenAppearance: () => void;
  onRequireAuth: () => void;
  onOpenUpgrade: () => void;
  onOpenOrganization: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  journeys: Journey[];
}) {
  const { data: session, status, update: updateSession } = useSession();
  const user = session?.user;
  const displayName = user?.name ?? "Guest";
  const authenticated = status === "authenticated";
  const currentOrgName = session?.user?.currentOrgName;

  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [pinned, setPinned] = useState<Conversation[]>([]);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgMenuOpen) return;
    let ignore = false;
    fetch("/api/orgs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setOrgs(data.organizations ?? []);
      })
      .finally(() => {
        if (!ignore) setLoadingOrgs(false);
      });
    return () => {
      ignore = true;
    };
  }, [orgMenuOpen]);

  async function handleSwitchOrg(orgId: string) {
    if (orgId === session?.user?.currentOrgId) {
      setOrgMenuOpen(false);
      return;
    }
    setSwitchingOrgId(orgId);
    try {
      const res = await fetch("/api/orgs/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        await updateSession();
        setOrgMenuOpen(false);
      }
    } finally {
      setSwitchingOrgId(null);
    }
  }

  useEffect(() => {
    if (!authenticated) return;

    let ignore = false;
    fetch("/api/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setPinned(data.pinned ?? []);
        setRecent(data.recent ?? []);
      })
      .finally(() => {
        if (!ignore) setLoadingChats(false);
      });

    return () => {
      ignore = true;
    };
  }, [authenticated]);

  async function handleNewChat() {
    if (!authenticated) {
      onRequireAuth();
      return;
    }
    const res = await fetch("/api/conversations", { method: "POST" });
    if (!res.ok) return;
    const conversation: Conversation = await res.json();
    setRecent((prev) => [conversation, ...prev]);
    setConversationsOpen(true);
    onChangeView("home");
    onSelectConversation(conversation.id);
  }

  async function togglePinned(conversation: Conversation) {
    const nextPinned = !conversation.pinned;
    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: nextPinned }),
    });
    if (!res.ok) return;
    const updated: Conversation = await res.json();
    setPinned((prev) => prev.filter((c) => c.id !== conversation.id));
    setRecent((prev) => prev.filter((c) => c.id !== conversation.id));
    if (updated.pinned) {
      setPinned((prev) => [updated, ...prev]);
    } else {
      setRecent((prev) => [updated, ...prev]);
    }
  }

  async function deleteConversation(conversation: Conversation) {
    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setPinned((prev) => prev.filter((c) => c.id !== conversation.id));
    setRecent((prev) => prev.filter((c) => c.id !== conversation.id));
    if (activeConversationId === conversation.id) {
      onSelectConversation(null);
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[267px] -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-fg transition-transform duration-200 md:static md:z-auto md:h-full md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="relative flex h-[94px] shrink-0 items-center justify-center border-b border-sidebar-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Z1P" className="h-9 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full text-sidebar-muted hover:text-sidebar-fg md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto border-b border-sidebar-border p-5">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            + New
          </button>

          <nav aria-label="Main" className="flex flex-col gap-0.5">
            {navItems.map(({ label, icon: Icon, view: itemView, requiresAuth }) => (
              <button
                key={label}
                type="button"
                aria-current={view === itemView ? "page" : undefined}
                onClick={
                  requiresAuth && !authenticated
                    ? onRequireAuth
                    : () => onChangeView(itemView)
                }
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-accent-soft/60 ${
                  view === itemView ? "bg-accent-soft" : ""
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={authenticated ? conversationsOpen : undefined}
              onClick={
                authenticated
                  ? () => setConversationsOpen((v) => !v)
                  : onRequireAuth
              }
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-accent-soft/60"
            >
              <ChatSparkIcon className="h-4.5 w-4.5" />
              Conversations
            </button>
            <button
              type="button"
              onClick={authenticated ? onOpenOrganization : onRequireAuth}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-accent-soft/60"
            >
              <UsersIcon className="h-4.5 w-4.5" />
              Organization
            </button>
          </nav>

          {authenticated && conversationsOpen && (
            <div className="-mt-3 flex flex-col gap-3 border-l border-sidebar-fg/15 py-1 pl-3">
              {loadingChats && pinned.length === 0 && recent.length === 0 && (
                <p className="text-xs text-sidebar-muted">Loading chats…</p>
              )}
              {!loadingChats && pinned.length === 0 && recent.length === 0 && (
                <p className="text-xs text-sidebar-muted">No chats yet</p>
              )}

              {pinned.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
                    Pinned
                  </span>
                  {pinned.map((conversation) => (
                    <ChatRow
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeConversationId}
                      onSelect={() => {
                        onChangeView("home");
                        onSelectConversation(conversation.id);
                      }}
                      onTogglePin={() => togglePinned(conversation)}
                      onDelete={() => deleteConversation(conversation)}
                    />
                  ))}
                </div>
              )}

              {recent.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
                    Recent
                  </span>
                  {recent.map((conversation) => (
                    <ChatRow
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeConversationId}
                      onSelect={() => {
                        onChangeView("home");
                        onSelectConversation(conversation.id);
                      }}
                      onTogglePin={() => togglePinned(conversation)}
                      onDelete={() => deleteConversation(conversation)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {journeys.length > 0 ? (
            <button
              type="button"
              onClick={() => onChangeView("journeys")}
              className="mt-auto flex flex-col gap-2 rounded-[10px] border border-sidebar-border p-2.5 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input-border text-accent">
                  <BookIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-sidebar-fg">
                  {journeys[0].title}
                </span>
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-fg/10">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${journeys[0].progress}%` }}
                />
              </span>
            </button>
          ) : (
            <div className="mt-auto flex flex-col gap-0.5 border border-sidebar-border rounded-[10px] p-2.5 text-center">
              <p className="text-sm font-medium text-sidebar-fg">
                You don&rsquo;t have
                <br />
                any journeys Yet
              </p>
              <button
                type="button"
                onClick={authenticated ? () => onChangeView("journeys") : onRequireAuth}
                className="mt-1 border-t border-sidebar-border pt-2 text-sm font-medium text-accent hover:underline"
              >
                Create Journey
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5 p-5">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-sidebar-fg/5"
          >
            <SparkleIcon className="h-4.5 w-4.5" />
            AI Assisted Guide
          </button>
          <button
            type="button"
            onClick={onOpenAppearance}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-sidebar-fg/5"
          >
            <SettingsIcon className="h-4.5 w-4.5" />
            Settings
          </button>
          <nav
            aria-label="Legal"
            className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-2.5 text-[11px] text-sidebar-muted"
          >
            <Link href="/terms" className="hover:text-sidebar-fg hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-sidebar-fg hover:underline">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-sidebar-fg hover:underline">
              Cookies
            </Link>
            <Link href="/refunds" className="hover:text-sidebar-fg hover:underline">
              Refunds
            </Link>
          </nav>
        </div>

        <div className="relative border-t border-sidebar-border p-4">
          {authenticated && orgMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close organization menu"
                onClick={() => setOrgMenuOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute bottom-full left-4 right-4 z-50 mb-2 flex flex-col gap-0.5 rounded-xl border border-sidebar-border bg-sidebar p-1.5 shadow-lg">
                {loadingOrgs && (
                  <p className="px-2 py-1.5 text-xs text-sidebar-muted">
                    Loading…
                  </p>
                )}
                {!loadingOrgs &&
                  orgs.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => handleSwitchOrg(org.id)}
                      disabled={switchingOrgId !== null}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-sidebar-fg transition-colors hover:bg-sidebar-fg/5 ${
                        org.isDefault ? "bg-sidebar-fg/5" : ""
                      }`}
                    >
                      <span className="truncate">{org.name}</span>
                      {switchingOrgId === org.id && (
                        <span className="shrink-0 text-xs text-sidebar-muted">
                          …
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar
                key={user?.image ?? "fallback"}
                image={user?.image}
                name={displayName}
                authenticated={status === "authenticated"}
              />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={authenticated ? onOpenUpgrade : onRequireAuth}
                  className="flex items-center gap-1.5"
                >
                  <span className="truncate text-sm font-semibold text-sidebar-fg">
                    {displayName}
                  </span>
                </button>
                <button
                  type="button"
                  aria-expanded={authenticated ? orgMenuOpen : undefined}
                  aria-label={
                    authenticated
                      ? `Switch organization (current: ${currentOrgName ?? "loading"})`
                      : undefined
                  }
                  onClick={
                    authenticated
                      ? () => setOrgMenuOpen((v) => !v)
                      : onRequireAuth
                  }
                  className="flex min-w-0 items-center gap-1 text-xs text-sidebar-muted hover:text-sidebar-fg"
                >
                  <span className="truncate">
                    {authenticated ? currentOrgName ?? "…" : "Sign in"}
                  </span>
                  {authenticated && (
                    <ChevronRightIcon
                      className={`h-3 w-3 shrink-0 transition-transform ${
                        orgMenuOpen ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={
                status === "authenticated" ? () => signOut() : onRequireAuth
              }
              aria-label={status === "authenticated" ? "Log out" : "Sign in"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-muted hover:text-sidebar-fg"
            >
              <LogoutIcon className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
