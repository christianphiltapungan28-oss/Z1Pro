import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations, users } from "@/db/schema";
import { createDbAdapter } from "@/lib/auth-adapter";

function personalOrgName(user: { name?: string | null; email?: string | null }) {
  const name = user.name?.trim();
  if (name) return `${name}'s Organization`;
  const emailLocalPart = user.email?.split("@")[0]?.trim();
  return emailLocalPart ? `${emailLocalPart}'s Organization` : "My Organization";
}

function providerProfileImage(profile: unknown) {
  if (!profile || typeof profile !== "object") return undefined;
  const picture = (profile as { picture?: unknown }).picture;
  if (typeof picture === "string") return picture;
  if (!picture || typeof picture !== "object") return undefined;
  const url = (picture as { data?: { url?: unknown } }).data?.url;
  return typeof url === "string" ? url : undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createDbAdapter(),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.currentOrgId = null;
      session.user.currentOrgName = null;
      session.user.currentOrgRole = null;

      const [row] = await db
        .select({ defaultOrgId: users.defaultOrgId })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (row?.defaultOrgId) {
        const [membership] = await db
          .select({
            orgId: organizations.id,
            orgName: organizations.name,
            role: organizationMembers.role,
          })
          .from(organizationMembers)
          .innerJoin(
            organizations,
            eq(organizationMembers.organizationId, organizations.id)
          )
          .where(
            and(
              eq(organizationMembers.organizationId, row.defaultOrgId),
              eq(organizationMembers.userId, user.id)
            )
          )
          .limit(1);

        if (membership) {
          session.user.currentOrgId = membership.orgId;
          session.user.currentOrgName = membership.orgName;
          session.user.currentOrgRole = membership.role;
        }
      }

      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      const profileImage = providerProfileImage(profile);
      if (
        (account?.provider === "google" || account?.provider === "facebook") &&
        user.id &&
        (user.name || user.image || profileImage)
      ) {
        await db
          .update(users)
          .set({
            displayName: user.name ?? undefined,
            avatarUrl: profileImage ?? user.image ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
    },
    async createUser({ user }) {
      if (!user.id) return;

      const [org] = await db
        .insert(organizations)
        .values({ name: personalOrgName(user) })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: "owner",
      });

      await db
        .update(users)
        .set({ defaultOrgId: org.id })
        .where(eq(users.id, user.id));
    },
  },
});
