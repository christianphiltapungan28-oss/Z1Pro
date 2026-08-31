import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createDbAdapter } from "@/lib/auth-adapter";

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
  },
});
