import postgres from "postgres";
import { randomBytes, randomUUID, createHash } from "node:crypto";

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { prepare: false });

const userId = randomUUID();
await sql`
  insert into users (id, email, display_name, role)
  values (${userId}, 'claude-verify@z1p.test', 'Claude', 'member')
`;

const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

await sql`
  insert into sessions (user_id, token_hash, expires_at)
  values (${userId}, ${tokenHash}, ${expires})
`;

console.log(JSON.stringify({ userId, token }));
await sql.end();
