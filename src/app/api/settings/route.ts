import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  oauthAccounts,
  userSettings,
  users,
  type NotificationPrefs,
} from "@/db/schema";
import { isMissingTable } from "@/lib/db-errors";
import { rateLimit } from "@/lib/rate-limit";
import { LANGUAGES } from "@/lib/settings";

const NOTIFICATION_KEYS: (keyof NotificationPrefs)[] = [
  "email",
  "push",
  "conversationReminders",
  "weeklyReport",
  "journeyMilestones",
  "marketing",
];

// Defaults shown before a user has changed anything (as in the design).
const DEFAULT_NOTIFICATIONS: Required<NotificationPrefs> = {
  email: true,
  push: true,
  conversationReminders: false,
  weeklyReport: true,
  journeyMilestones: true,
  marketing: false,
};

const LIMITS = { name: 80, phone: 30, about: 300, country: 60 } as const;

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function loadSettings(userId: string) {
  try {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    return { ready: true as const, row: row ?? null };
  } catch (err) {
    // The table is created by scripts/add-user-settings.sql; until then the
    // rest of Settings still works.
    if (isMissingTable(err)) return { ready: false as const, row: null };
    throw err;
  }
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      name: users.displayName,
      email: users.email,
      image: users.avatarUrl,
      locale: users.locale,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providers = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  const settings = await loadSettings(userId);
  const row = settings.row;

  return NextResponse.json({
    settingsReady: settings.ready,
    providers: providers.map((p) => p.provider),
    profile: {
      ...user,
      phone: row?.phone ?? null,
      timezone: row?.timezone ?? null,
      about: row?.about ?? null,
      country: row?.country ?? null,
    },
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(row?.notificationPrefs ?? {}) },
  });
}

function cleanText(value: unknown, max: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`settings:update:${userId}`, 30, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many changes. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => ({}));

  // Fields on the users table.
  const userUpdate: Partial<typeof users.$inferInsert> = {};
  if ("name" in body) {
    const name = cleanText(body.name, LIMITS.name);
    if (!name) {
      return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    }
    userUpdate.displayName = name;
  }
  if ("locale" in body) {
    if (!(typeof body.locale === "string" && body.locale in LANGUAGES)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }
    userUpdate.locale = body.locale;
  }

  // Fields on user_settings.
  const settingsUpdate: Partial<typeof userSettings.$inferInsert> = {};
  if ("phone" in body) {
    const phone = cleanText(body.phone, LIMITS.phone);
    if (phone && !/^\+?[0-9 ()-]{5,30}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }
    settingsUpdate.phone = phone ?? null;
  }
  if ("timezone" in body) {
    const tz = cleanText(body.timezone, 64);
    if (tz && !validTimezone(tz)) {
      return NextResponse.json({ error: "Unknown timezone" }, { status: 400 });
    }
    settingsUpdate.timezone = tz ?? null;
  }
  if ("about" in body) settingsUpdate.about = cleanText(body.about, LIMITS.about) ?? null;
  if ("country" in body) settingsUpdate.country = cleanText(body.country, LIMITS.country) ?? null;
  if ("notifications" in body && body.notifications && typeof body.notifications === "object") {
    const current = (await loadSettings(userId)).row?.notificationPrefs ?? {};
    const next: NotificationPrefs = { ...current };
    for (const key of NOTIFICATION_KEYS) {
      if (typeof body.notifications[key] === "boolean") next[key] = body.notifications[key];
    }
    settingsUpdate.notificationPrefs = next;
  }

  if (Object.keys(userUpdate).length > 0) {
    await db
      .update(users)
      .set({ ...userUpdate, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  if (Object.keys(settingsUpdate).length > 0) {
    try {
      await db
        .insert(userSettings)
        .values({ userId, ...settingsUpdate })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { ...settingsUpdate, updatedAt: new Date() },
        });
    } catch (err) {
      if (isMissingTable(err)) {
        return NextResponse.json(
          { error: "These settings aren't available yet. Please try again later." },
          { status: 503 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ ok: true });
}
