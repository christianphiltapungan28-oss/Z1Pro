import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userTwoFactor } from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { redis } from "@/lib/rate-limit";
import { open } from "@/lib/secret-box";
import { verifyTotp } from "@/lib/totp";

const BACKUP_CODES = 10;
const TICKET_SECONDS = 5 * 60;
const TICKET_ATTEMPTS = 5;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The user's two-factor row, null when off; `ready` is false before the SQL script. */
export async function getTwoFactor(userId: string) {
  try {
    const [row] = await db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId))
      .limit(1);
    return { ready: true, row: row ?? null };
  } catch (err) {
    if (isMissingTable(err)) return { ready: false, row: null };
    throw err;
  }
}

/** Ten one-time backup codes like "k3v9-7qpx", and their hashes to store. */
export function newBackupCodes() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    const chars = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

const normaliseBackup = (code: string) =>
  code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^(.{4})(.{4})$/, "$1-$2");

/**
 * Checks an authenticator code or a backup code for a user with two-factor
 * on. A code is accepted once (replays within its time window fail); a
 * backup code is used up.
 */
export async function checkSecondFactor(userId: string, code: string) {
  const { row } = await getTwoFactor(userId);
  if (!row) return false;

  const digits = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(digits)) {
    const step = verifyTotp(open(row.secretCiphertext), digits);
    if (step === null) return false;
    const fresh = await redis.set(`2fa:used:${userId}:${step}`, "1", { nx: true, ex: 120 });
    return !!fresh;
  }

  // Removing the code only if it's still there, in one statement, so the
  // same backup code sent twice at once is accepted once.
  const hash = sha256(normaliseBackup(code));
  const used = await db
    .update(userTwoFactor)
    .set({ backupCodeHashes: sql`${userTwoFactor.backupCodeHashes} - ${hash}::text` })
    .where(
      and(
        eq(userTwoFactor.userId, userId),
        sql`${userTwoFactor.backupCodeHashes} @> jsonb_build_array(${hash}::text)`,
      ),
    )
    .returning({ userId: userTwoFactor.userId });
  return used.length > 0;
}

// Between "password correct" and "code correct": a short-lived ticket, so
// the second step doesn't need the password again.

/** A Google/Facebook account to link once the code is right (src/lib/oauth-gate.ts). */
export type PendingLink = { provider: string; providerAccountId: string; email: string };
type Ticket = { userId: string; attempts: number; link?: PendingLink };
const ticketKey = (ticket: string) => `2fa:ticket:${sha256(ticket)}`;

export async function issueLoginTicket(userId: string, link?: PendingLink) {
  const ticket = randomBytes(32).toString("base64url");
  await redis.set(ticketKey(ticket), { userId, attempts: 0, link } satisfies Ticket, {
    ex: TICKET_SECONDS,
  });
  return ticket;
}

/**
 * Checks the code for a login ticket. Returns the user id on success (the
 * ticket is then spent), or an error message.
 */
export async function redeemLoginTicket(ticket: string, code: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(ticket)) return { error: "Log in again." } as const;
  const data = await redis.get<Ticket>(ticketKey(ticket));
  if (!data) return { error: "That took too long. Log in again." } as const;
  if (await checkSecondFactor(data.userId, code)) {
    await redis.del(ticketKey(ticket));
    return { userId: data.userId, link: data.link } as const;
  }
  const attempts = data.attempts + 1;
  if (attempts >= TICKET_ATTEMPTS) {
    await redis.del(ticketKey(ticket));
    return { error: "Too many wrong codes. Log in again." } as const;
  }
  await redis.set(ticketKey(ticket), { ...data, attempts }, { keepTtl: true });
  return { error: "That code isn't right. Check your authenticator app and try again." } as const;
}
