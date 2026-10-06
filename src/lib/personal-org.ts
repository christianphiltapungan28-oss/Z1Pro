import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations, users } from "@/db/schema";

function personalOrgName(user: { name?: string | null; email?: string | null }) {
  const name = user.name?.trim();
  if (name) return `${name}'s Organization`;
  const emailLocalPart = user.email?.split("@")[0]?.trim();
  return emailLocalPart ? `${emailLocalPart}'s Organization` : "My Organization";
}

/** Every new account gets its own organization, owned by it and made default. */
export async function createPersonalOrg(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}) {
  const [org] = await db
    .insert(organizations)
    .values({ name: personalOrgName(user) })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: user.id,
    role: "owner",
  });

  await db.update(users).set({ defaultOrgId: org.id }).where(eq(users.id, user.id));
}
