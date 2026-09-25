import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAgo, formatClock, formatDate, formatDay, formatDuration, formatIn,
  formatMinutes, initials, plural, shortSha,
} from "../src/lib/format.ts";

const NOW = Date.UTC(2026, 10, 20, 14, 32, 0); // Fri 20 Nov 2026, 14:32 UTC

test("formatClock prints UTC hours and minutes", () => {
  assert.equal(formatClock(NOW), "14:32");
  assert.equal(formatClock(Date.UTC(2026, 0, 2, 3, 4, 0)), "03:04");
});

test("formatAgo covers seconds, minutes, hours, days and older dates", () => {
  assert.equal(formatAgo(NOW - 10_000, NOW), "just now");
  assert.equal(formatAgo(NOW - 5 * 60_000, NOW), "5m ago");
  assert.equal(formatAgo(NOW - 3 * 3_600_000, NOW), "3h ago");
  assert.equal(formatAgo(NOW - 2 * 3_600_000 - 25 * 60_000, NOW), "2h 25m ago");
  assert.equal(formatAgo(NOW - 3 * 86_400_000, NOW), "3d ago");
  assert.equal(formatAgo(NOW - 20 * 86_400_000, NOW), "31 Oct");
});

test("formatIn prints deadlines, and due now once the deadline passes", () => {
  assert.equal(formatIn(NOW + 4 * 60_000, NOW), "in 4m");
  assert.equal(formatIn(NOW + 3 * 3_600_000, NOW), "in 3h");
  assert.equal(formatIn(NOW + 2 * 86_400_000, NOW), "in 2d");
  assert.equal(formatIn(NOW - 1_000, NOW), "due now");
});

test("formatDuration and formatMinutes keep the units readable", () => {
  assert.equal(formatDuration(42), "42s");
  assert.equal(formatDuration(96), "1m 36s");
  assert.equal(formatDuration(120), "2m");
  assert.equal(formatMinutes(38), "38m");
  assert.equal(formatMinutes(72), "1h 12m");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(Number.NaN), "n/a");
});

test("formatDay groups by UTC day and formats older dates", () => {
  assert.equal(formatDay(NOW - 60_000, NOW), "Today");
  assert.equal(formatDay(NOW - 86_400_000, NOW), "Yesterday");
  assert.equal(formatDay(NOW - 5 * 86_400_000, NOW), "15 Nov");
  assert.equal(formatDate(NOW), "20 Nov");
});

test("initials, shortSha and plural are the small helpers the UI shares", () => {
  assert.equal(initials("Nisha Pradhan"), "NP");
  assert.equal(initials("Arun"), "A");
  assert.equal(initials("  "), "");
  assert.equal(shortSha("9f3a1c2be41d"), "9f3a1c2");
  assert.equal(plural(1, "incident"), "incident");
  assert.equal(plural(2, "incident"), "incidents");
  assert.equal(plural(2, "deploy", "deploys"), "deploys");
});
