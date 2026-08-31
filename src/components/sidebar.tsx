"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  CloseIcon,
  HelpIcon,
  HistoryIcon,
  LogoutIcon,
  PinIcon,
  PlusIcon,
  SettingsIcon,
  ToolsIcon,
  TrashIcon,
} from "@/components/icons";

const navItems = [
  { label: "History", icon: HistoryIcon, requiresAuth: true },
  { label: "Tools", icon: ToolsIcon, requiresAuth: false },
  { label: "Help", icon: HelpIcon, requiresAuth: false },
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffc5d1] to-[#7b6bff] font-display text-sm font-semibold text-white">
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
      className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-sidebar-foreground/90 transition-colors hover:bg-sidebar-foreground/5 ${
        active ? "bg-sidebar-foreground/10" : ""
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
        aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
        aria-pressed={conversation.pinned}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
          conversation.pinned
            ? "text-[#ff6791]"
            : "opacity-0 group-hover:opacity-100 hover:text-sidebar-foreground"
        }`}
      >
        <PinIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete chat"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-0 transition-colors hover:text-sidebar-foreground group-hover:opacity-100"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  onOpenAppearance,
  onRequireAuth,
  onOpenUpgrade,
  activeConversationId,
  onSelectConversation,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAppearance: () => void;
  onRequireAuth: () => void;
  onOpenUpgrade: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
}) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const displayName = user?.name ?? "Guest";
  const authenticated = status === "authenticated";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [pinned, setPinned] = useState<Conversation[]>([]);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

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
    setHistoryOpen(true);
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
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 -translate-x-full shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
        style={{
          margin: "var(--sidebar-inset)",
          borderRadius: "var(--sidebar-radius)",
          padding: "1.5px",
          background: "var(--sidebar-gradient-border, var(--sidebar-border))",
        }}
      >
        <aside
          className="flex h-full flex-col overflow-y-auto bg-sidebar p-4 text-sidebar-foreground shadow-[0_8px_32px_rgba(0,0,0,0.35)] ring-1 ring-sidebar-border backdrop-blur-2xl backdrop-saturate-150"
          style={{
            borderRadius: "calc(var(--sidebar-radius) - 1.5px)",
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                key={user?.image ?? "fallback"}
                image={user?.image}
                name={displayName}
                authenticated={status === "authenticated"}
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    {displayName}
                  </span>
                  {status === "authenticated" && (
                    <span className="rounded-full bg-[#ffc3cf] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a2745]">
                      Free
                    </span>
                  )}
                </div>
                <p className="text-xs text-sidebar-muted">
                  {status === "authenticated"
                    ? (user?.email ?? "")
                    : "Not signed in"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-full text-sidebar-muted hover:text-sidebar-foreground md:hidden"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={authenticated ? onOpenUpgrade : onRequireAuth}
            className="mb-3 w-full rounded-full bg-gradient-to-r from-[#ffc5d1] to-[#ff7892] py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Upgrade to Ultra
          </button>

          <button
            type="button"
            onClick={handleNewChat}
            className="mb-5 flex w-full items-center gap-2 rounded-xl bg-[#ff6791]/10 px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-[#ff6791]/15"
          >
            <PlusIcon className="h-4 w-4 text-[#ff6791]" />
            New Chat
          </button>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {navItems.map(({ label, icon: Icon, requiresAuth }) => {
              const isHistory = label === "History";
              return (
                <button
                  key={label}
                  type="button"
                  onClick={
                    requiresAuth && !authenticated
                      ? onRequireAuth
                      : isHistory
                        ? () => setHistoryOpen((open) => !open)
                        : undefined
                  }
                  className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
                >
                  <Icon className="h-4.5 w-4.5" />
                  {label}
                </button>
              );
            })}

            {authenticated && historyOpen && (
              <div className="ml-1 flex flex-col gap-3 border-l border-sidebar-foreground/15 py-1 pl-3">
                {loadingChats && pinned.length === 0 && recent.length === 0 && (
                  <p className="text-xs text-sidebar-muted">Loading chats…</p>
                )}
                {!loadingChats &&
                  pinned.length === 0 &&
                  recent.length === 0 && (
                    <p className="text-xs text-sidebar-muted">
                      No chats yet
                    </p>
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
                        onSelect={() => onSelectConversation(conversation.id)}
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
                        onSelect={() => onSelectConversation(conversation.id)}
                        onTogglePin={() => togglePinned(conversation)}
                        onDelete={() => deleteConversation(conversation)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onOpenAppearance}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
            >
              <SettingsIcon className="h-4.5 w-4.5" />
              Settings
            </button>
          </nav>

          <button
            type="button"
            onClick={
              status === "authenticated" ? () => signOut() : onRequireAuth
            }
            className="flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
          >
            <LogoutIcon className="h-4.5 w-4.5" />
            {status === "authenticated" ? "Log out" : "Sign in"}
          </button>
        </aside>
      </div>
    </>
  );
}
