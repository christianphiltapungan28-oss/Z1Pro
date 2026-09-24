"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { View } from "@/components/app-shell";
import type { Journey } from "@/types/journey";
import { AssetIcon } from "@/components/asset-icon";
import {
  ChevronRightIcon,
  CloseIcon,
  HomeIcon,
  SettingsIcon,
  StacksIcon,
  UsersIcon,
} from "@/components/icons";

type OrgSummary = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  isDefault: boolean;
};


const navItems: {
  label: string;
  icon: typeof HomeIcon;
  view: View;
  requiresAuth: boolean;
}[] = [
  { label: "Home", icon: HomeIcon, view: "home", requiresAuth: false },
  { label: "Journeys", icon: StacksIcon, view: "journeys", requiresAuth: true },
];

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
        className="h-[49px] w-[49px] shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong font-display text-sm font-semibold text-white">
      {authenticated ? initials(name) : "?"}
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
  onNewChat,
  onOpenJourney,
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
  onNewChat: () => void;
  onOpenJourney: (journey: Journey) => void;
  journeys: Journey[];
}) {
  const { data: session, status, update: updateSession } = useSession();
  const user = session?.user;
  const displayName = user?.name ?? "Guest";
  const authenticated = status === "authenticated";
  const currentOrgName = session?.user?.currentOrgName;

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

  const navItemClass = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-[10px] p-2.5 text-left text-lg text-sidebar-fg transition-colors hover:bg-accent-soft/60 ${
      active ? "bg-accent-soft" : ""
    }`;

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[267px] -translate-x-full flex-col border-r border-divider bg-sidebar text-sidebar-fg transition-transform duration-200 md:static md:z-auto md:h-full md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="relative flex h-[94px] shrink-0 items-center justify-center border-b border-divider p-2.5">
          <div role="img" aria-label="Z1P" className="grid place-items-start leading-none">
            <span className="col-start-1 row-start-1 ml-[32.88px] font-logo text-[45px] font-extrabold leading-normal text-logo">
              Z1P
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ui/logo-mark.svg"
              alt=""
              width={31.9209}
              height={31.9209}
              className="col-start-1 row-start-1 mt-[15.32px]"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full text-sidebar-muted hover:text-sidebar-fg md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-[21px] pt-[34px] pb-4">
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-11 w-full shrink-0 items-center rounded-[15px] bg-accent py-2.5 pl-[22px] pr-2.5 text-xl font-medium text-white transition-opacity hover:opacity-90"
          >
            + New
          </button>

          <nav aria-label="Main" className="mt-6 flex flex-col gap-0.5">
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
                className={navItemClass(view === itemView)}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-current={
                view === "conversations" || view === "conversation" ? "page" : undefined
              }
              onClick={authenticated ? () => onChangeView("conversations") : onRequireAuth}
              className={navItemClass(view === "conversations" || view === "conversation")}
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <AssetIcon name="conversations" width={16.0005} height={16.0005} />
              </span>
              Conversations
            </button>
            <button
              type="button"
              onClick={authenticated ? onOpenOrganization : onRequireAuth}
              className={navItemClass(false)}
            >
              <UsersIcon className="h-[18px] w-[18px] shrink-0" />
              Organization
            </button>
          </nav>

          <p className="mt-6 py-2.5 pr-2.5 pl-2.5 text-base font-medium text-sidebar-fg">
            Recent
          </p>

          {journeys.length > 0 ? (
            <div className="flex flex-col">
              {journeys.slice(0, 4).map((journey) => (
                <button
                  key={journey.id}
                  type="button"
                  onClick={() => onOpenJourney(journey)}
                  className="flex items-center gap-2.5 rounded-[10px] p-2.5 text-left text-base text-sidebar-recent transition-colors hover:bg-sidebar-fg/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-start justify-center pt-[0.5px]">
                    <AssetIcon name="journey-book-muted" width={22} height={19.4717} />
                  </span>
                  <span className="min-w-0 truncate">{journey.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-[200px] shrink-0 flex-col items-center justify-center gap-2.5 rounded-[10px] border border-sidebar-border p-2.5 text-center">
              <p className="whitespace-nowrap text-xl font-medium text-sidebar-fg">
                You don&rsquo;t have
                <br />
                any journeys Yet
              </p>
              <button
                type="button"
                onClick={authenticated ? () => onChangeView("journeys") : onRequireAuth}
                className="w-[123px] border-b border-accent pb-0.5 text-base font-medium text-accent"
              >
                Create Journey
              </button>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-0.5 pt-3">
            <button
              type="button"
              className={navItemClass(false)}
            >
              <AssetIcon name="ai-guide" width={18} height={18} />
              AI Assisted Guide
            </button>
            <button
              type="button"
              onClick={onOpenAppearance}
              className={navItemClass(false)}
            >
              <SettingsIcon className="h-[18px] w-[18px] shrink-0" />
              Settings
            </button>
            <nav
              aria-label="Legal"
              className="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-2.5 text-[11px] text-sidebar-muted"
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
        </div>

        <div className="relative flex h-[89px] shrink-0 items-center justify-center border-t border-divider p-2.5">
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

          <div className="flex w-full items-center justify-center gap-[21px]">
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar
                key={user?.image ?? "fallback"}
                image={user?.image}
                name={displayName}
                authenticated={status === "authenticated"}
              />
              <div className="flex w-[117px] min-w-0 flex-col">
                <button
                  type="button"
                  onClick={authenticated ? onOpenUpgrade : onRequireAuth}
                  className="-mb-0.5 truncate text-left text-lg text-sidebar-fg"
                >
                  {displayName}
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
                  className="flex min-w-0 items-center gap-1 text-left text-sm text-sidebar-fg hover:text-accent"
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-fg hover:text-accent"
            >
              <AssetIcon name="logout" width={18} height={17.25} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
