const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "just now", "5 minutes ago", "2 hours ago", "Yesterday", then "Sep 5"
 * (with the year once it's not this year) — as used in the Conversations
 * list and headers.
 */
export function formatRelativeTime(iso: string, now = new Date()) {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (isSameDay(date, now)) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
