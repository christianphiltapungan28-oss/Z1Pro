import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations, users } from "@/db/schema";
import { createDbAdapter } from "@/lib/auth-adapter";
import { betaAllows } from "@/lib/beta";
import { createPersonalOrg } from "@/lib/personal-org";

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
      // Someone who signed up with a password can later use "Sign in with
      // Google" for the same address. Safe because Google verifies emails and
      // password accounts only exist after their email was confirmed.
      allowDangerousEmailAccountLinking: true,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Private beta: runs before an account is created, so uninvited people
    // never get one (src/lib/beta.ts).
    signIn({ user }) {
      return betaAllows(user.email) ? true : "/login?error=NotInvited";
    },
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
      const profileImage = providerProfileImage(profile) ?? user.image;
      if (
        (account?.provider === "google" || account?.provider === "facebook") &&
        user.id &&
        (user.name || profileImage)
      ) {
        await db
          .update(users)
          .set({
            displayName: user.name ?? undefined,
            // A photo uploaded in Settings (a data: URL) wins over the
            // provider's picture, which would otherwise replace it each sign-in.
            avatarUrl: profileImage
              ? sql`case when ${users.avatarUrl} like 'data:%' then ${users.avatarUrl} else ${profileImage} end`
              : undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
    },
    async createUser({ user }) {
      if (!user.id) return;
      await createPersonalOrg({ id: user.id, name: user.name, email: user.email });
    },
  },
});
