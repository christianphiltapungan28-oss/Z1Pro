import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { db } from "@/db";
import { oauthAccounts, sessions, users } from "@/db/schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAdapterUser(row: typeof users.$inferSelect): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerifiedAt,
    name: row.displayName,
    image: row.avatarUrl,
  };
}

export function createDbAdapter(): Adapter {
  return {
    async createUser(user) {
      const [row] = await db
        .insert(users)
        .values({
          id: user.id || randomUUID(),
          email: user.email,
          emailVerifiedAt: user.emailVerified,
          displayName: user.name,
          avatarUrl: user.image,
        })
        .returning();
      return toAdapterUser(row);
    },

    async getUser(id) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const [row] = await db
        .select({ user: users })
        .from(oauthAccounts)
        .innerJoin(users, eq(oauthAccounts.userId, users.id))
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerUserId, providerAccountId)
          )
        )
        .limit(1);
      return row ? toAdapterUser(row.user) : null;
    },

    async updateUser(user) {
      const [row] = await db
        .update(users)
        .set({
          email: user.email,
          emailVerifiedAt: user.emailVerified,
          displayName: user.name,
          avatarUrl: user.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      return toAdapterUser(row);
    },

    async deleteUser(userId) {
      await db.delete(users).where(eq(users.id, userId));
    },

    async linkAccount(account) {
      await db.insert(oauthAccounts).values({
        userId: account.userId,
        provider: account.provider,
        providerUserId: account.providerAccountId,
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await db
        .delete(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.provider, provider),
            eq(oauthAccounts.providerUserId, providerAccountId)
          )
        );
    },

    async createSession({ sessionToken, userId, expires }) {
      await db.insert(sessions).values({
        userId,
        tokenHash: hashToken(sessionToken),
        expiresAt: expires,
      });
      return { sessionToken, userId, expires };
    },

    async getSessionAndUser(sessionToken) {
      const tokenHash = hashToken(sessionToken);
      const [row] = await db
        .select({ session: sessions, user: users })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt))
        )
        .limit(1);
      if (!row) return null;
      if (row.session.expiresAt.getTime() < Date.now()) return null;
      return {
        session: {
          sessionToken,
          userId: row.session.userId,
          expires: row.session.expiresAt,
        },
        user: toAdapterUser(row.user),
      };
    },

    async updateSession({ sessionToken, expires }) {
      if (!expires) return null;
      const tokenHash = hashToken(sessionToken);
      const [row] = await db
        .update(sessions)
        .set({ expiresAt: expires })
        .where(eq(sessions.tokenHash, tokenHash))
        .returning();
      if (!row) return null;
      return { sessionToken, userId: row.userId, expires: row.expiresAt };
    },

    async deleteSession(sessionToken) {
      const tokenHash = hashToken(sessionToken);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
  };
}
