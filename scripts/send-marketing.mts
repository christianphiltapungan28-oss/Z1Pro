// Emails a tip or product update to everyone who turned on
// Settings → Notifications → Marketing & Tips. Each email has an
// unsubscribe link (and one-click unsubscribe headers).
//
// Dry run (default) — shows who would get it, sends nothing:
//   npx tsx --env-file=.env --env-file=.env.local scripts/send-marketing.mts --subject "New: voice journeys" --body update.txt
// Really send:
//   ... add --send
// Optional: --button "Open Z1P" --link /?view=journeys, --test you@example.com
// (--test sends only to that address, whether or not it opted in).
//
// The body file is plain text; blank lines separate paragraphs.

import { readFileSync } from "node:fs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { users, userSettings } from "../src/db/schema";
import { emailConfigured, emailLink, sendEmail } from "../src/lib/email";
import { unsubscribeLink } from "../src/lib/unsubscribe";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const subject = arg("subject");
const bodyFile = arg("body");
const send = process.argv.includes("--send");
const test = arg("test");
const buttonLabel = arg("button") ?? "Open Z1P";
const link = arg("link") ?? "/";

if (!subject || !bodyFile) {
  console.error('Usage: scripts/send-marketing.mts --subject "…" --body file.txt [--send] [--test you@example.com]');
  process.exit(1);
}
if (!emailConfigured()) {
  console.error("RESEND_API_KEY and EMAIL_FROM must be set.");
  process.exit(1);
}

const body = readFileSync(bodyFile, "utf8").trim();

const recipients = test
  ? await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${test.toLowerCase()}`)
  : await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          sql`(${userSettings.notificationPrefs} ->> 'marketing') = 'true'`
        )
      );

console.log(`${recipients.length} recipient(s)${test ? " (test)" : " opted in to Marketing & Tips"}.`);
if (!send) {
  for (const r of recipients.slice(0, 20)) console.log(`  ${r.email}`);
  if (recipients.length > 20) console.log(`  …and ${recipients.length - 20} more`);
  console.log("Dry run: nothing sent. Add --send to send.");
  process.exit(0);
}

let sent = 0;
for (const r of recipients) {
  const ok = await sendEmail({
    to: r.email,
    subject,
    heading: subject,
    body,
    button: { label: buttonLabel, url: emailLink(link) },
    footer: "You get this because Marketing & Tips is on in Z1P Settings → Notifications.",
    unsubscribeUrl: unsubscribeLink(r.id),
  });
  if (ok) sent += 1;
  else console.error(`  failed: ${r.email}`);
  // Stay under Resend's default rate limit (2 requests a second).
  await new Promise((resolve) => setTimeout(resolve, 600));
}
console.log(`Sent ${sent} of ${recipients.length}.`);
process.exit(0);
