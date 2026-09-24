"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CloseIcon, TrashIcon } from "@/components/icons";
import { useDialog } from "@/lib/use-dialog";

type Member = {
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
};

type Invite = {
  id: string;
  role: "admin" | "member";
  email: string | null;
  expiresAt: string;
  createdAt: string;
};

type Tab = "members" | "invites";

export function OrganizationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session, update: updateSession } = useSession();
  const orgId = session?.user?.currentOrgId ?? null;
  const orgRole = session?.user?.currentOrgRole ?? null;
  const canManage = orgRole === "owner" || orgRole === "admin";

  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !orgId) return;
    let ignore = false;

    Promise.all([
      fetch(`/api/orgs/${orgId}/members`).then((res) =>
        res.ok ? res.json() : null
      ),
      canManage
        ? fetch(`/api/orgs/${orgId}/invites`).then((res) =>
            res.ok ? res.json() : null
          )
        : Promise.resolve(null),
    ])
      .then(([membersData, invitesData]) => {
        if (ignore) return;
        setError(null);
        if (membersData) setMembers(membersData.members ?? []);
        if (invitesData) setInvites(invitesData.invites ?? []);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, orgId, canManage]);

  async function handleCreateInvite() {
    if (!orgId) return;
    setCreatingInvite(true);
    setError(null);
    setNewInviteUrl(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
          email: inviteEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create invite");
        return;
      }
      const invite = await res.json();
      setNewInviteUrl(invite.url);
      setInviteEmail("");
      setInvites((prev) => [
        { id: invite.id, role: invite.role, email: invite.email, expiresAt: invite.expiresAt, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!orgId) return;
    const res = await fetch(`/api/orgs/${orgId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function handleChangeRole(userId: string, role: Member["role"]) {
    if (!orgId) return;
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update role");
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role } : m))
    );
  }

  async function handleRemoveMember(userId: string) {
    if (!orgId) return;
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not remove member");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    if (userId === session?.user?.id) {
      await updateSession();
      onClose();
    }
  }

  const panelRef = useDialog(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close organization settings"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-dialog-title"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-card-border bg-background p-6 shadow-xl outline-none"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2
            id="organization-dialog-title"
            className="font-display text-xl font-semibold text-foreground"
          >
            {session?.user?.currentOrgName ?? "Organization"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Organization settings"
          className="mb-4 flex gap-1 border-b border-card-border pt-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "members"}
            onClick={() => setTab("members")}
            className={`px-3 py-2 text-sm font-medium ${
              tab === "members"
                ? "border-b-2 border-accent text-foreground"
                : "text-muted"
            }`}
          >
            Members
          </button>
          {canManage && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "invites"}
              onClick={() => setTab("invites")}
              className={`px-3 py-2 text-sm font-medium ${
                tab === "invites"
                  ? "border-b-2 border-accent text-foreground"
                  : "text-muted"
              }`}
            >
              Invites
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        {loading && (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        )}

        {!loading && tab === "members" && (
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-lg border border-card-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {member.displayName ?? member.email}
                  </p>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {orgRole === "owner" && member.userId !== session?.user?.id ? (
                    <select
                      aria-label={`Role for ${member.displayName ?? member.email}`}
                      value={member.role}
                      onChange={(e) =>
                        handleChangeRole(
                          member.userId,
                          e.target.value as Member["role"]
                        )
                      }
                      className="rounded-md border border-input-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-badge-bg px-2 py-0.5 text-[11px] font-semibold capitalize text-badge-fg">
                      {member.role}
                    </span>
                  )}
                  {(canManage || member.userId === session?.user?.id) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      aria-label={
                        member.userId === session?.user?.id
                          ? "Leave organization"
                          : "Remove member"
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-foreground"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === "invites" && canManage && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-lg border border-card-border p-4">
              <p className="text-sm font-semibold text-foreground">
                Invite a teammate
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "admin" | "member")
                  }
                  className="rounded-md border border-input-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  type="email"
                  aria-label="Invitee email (optional)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="min-w-0 flex-1 rounded-md border border-input-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={handleCreateInvite}
                  disabled={creatingInvite}
                  className="rounded-full bg-gradient-to-r from-accent to-accent-strong px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {creatingInvite ? "Creating…" : "Create link"}
                </button>
              </div>
              {newInviteUrl && (
                <div className="flex items-center gap-2 rounded-md bg-accent-soft/40 px-3 py-2 text-xs text-foreground">
                  <span className="min-w-0 flex-1 truncate">{newInviteUrl}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(newInviteUrl)}
                    className="shrink-0 font-semibold text-accent hover:underline"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {invites.length === 0 && (
                <p className="text-sm text-muted">No pending invites.</p>
              )}
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-card-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {invite.email ?? "Open link"} ·{" "}
                      <span className="capitalize text-muted">{invite.role}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(invite.id)}
                    aria-label="Revoke invite"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
