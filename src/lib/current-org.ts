import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMembers, users } from "@/db/schema";

export type OrgRole = "owner" | "admin" | "member";

export type CurrentOrg = {
  orgId: string;
  role: OrgRole;
  userId: string;
};

/**
 * Resolves the signed-in user's current organization and their role in it,
 * via `users.defaultOrgId`. Returns null if unauthenticated, if the user has
 * no default org yet, or if `defaultOrgId` points at an org they're no
 * longer a member of (e.g. they were removed).
 */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [user] = await db
    .select({ defaultOrgId: users.defaultOrgId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.defaultOrgId) return null;

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, user.defaultOrgId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  if (!membership) return null;

  return { orgId: user.defaultOrgId, role: membership.role, userId };
}
