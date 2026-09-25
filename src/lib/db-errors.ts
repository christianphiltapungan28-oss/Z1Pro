/**
 * True for Postgres "undefined_table" — a table a migration script hasn't
 * created yet. Drizzle wraps driver errors, so the wrapped cause is checked
 * too. Used to show a "not set up yet" state instead of crashing.
 */
export function isMissingTable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, cause } = err as { code?: string; cause?: unknown };
  return code === "42P01" || (cause !== undefined && isMissingTable(cause));
}
