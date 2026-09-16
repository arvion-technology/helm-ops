/**
 * Formatting helpers. Every function takes the current time as an argument so
 * the tests can freeze the clock, and everything that prints a date prints UTC
 * so a screenshot taken in Kathmandu matches one taken in Frankfurt.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (value: number) => String(value).padStart(2, "0");

export function formatClock(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatAgo(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 45_000) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    const minutes = Math.round((diff - hours * HOUR) / MINUTE);
    return minutes > 0 && hours < 6 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

/** For deadlines in the future, and for showing how late something is. */
export function formatIn(ts: number, now: number): string {
  const diff = ts - now;
  if (diff <= 0) return "due now";
  if (diff < HOUR) return `in ${Math.max(1, Math.round(diff / MINUTE))}m`;
  if (diff < DAY) return `in ${Math.floor(diff / HOUR)}h`;
  return `in ${Math.floor(diff / DAY)}d`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return "n/a";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** Day label used to group the deploy timeline. */
export function formatDay(ts: number, now: number): string {
  const day = Math.floor(ts / DAY);
  const today = Math.floor(now / DAY);
  if (day === today) return "Today";
  if (day === today - 1) return "Yesterday";
  return formatDate(ts);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function plural(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`);
}
