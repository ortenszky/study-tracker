import test from "node:test";
import assert from "node:assert/strict";
import { allocateSessions, getCalendarWeeks, getLongestStreak } from "../lib/analytics";

test("splits a session across local calendar days", () => {
  const result = allocateSessions([
    {
      id: "one",
      courseId: "course",
      title: "Course",
      color: "#000000",
      startTime: new Date("2026-10-01T21:30:00.000Z"),
      endTime: new Date("2026-10-01T22:30:00.000Z"),
    },
  ], "Europe/Budapest");

  assert.equal(result.secondsByDate.get("2026-10-01"), 1800);
  assert.equal(result.secondsByDate.get("2026-10-02"), 1800);
});

test("course totals use the same all-time denominator", () => {
  const result = allocateSessions([
    { id: "a", courseId: "a", title: "A", color: "#a", startTime: new Date("2026-01-01T10:00:00Z"), endTime: new Date("2026-01-01T11:00:00Z") },
    { id: "b", courseId: "b", title: "B", color: "#b", startTime: new Date("2025-01-01T10:00:00Z"), endTime: new Date("2025-01-01T11:00:00Z") },
  ], "UTC");

  const percentages = Array.from(result.secondsByCourse.values()).map((item) => item.seconds / result.totalSeconds);
  assert.equal(percentages.reduce((sum, value) => sum + value, 0), 1);
});

test("finds the longest consecutive-day run", () => {
  assert.equal(getLongestStreak(["2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05", "2026-01-06"]), 3);
});

test("calendar heatmap weeks are Sunday-aligned", () => {
  const weeks = getCalendarWeeks([{ date: "2026-01-01" }, { date: "2026-01-02" }]);
  assert.equal(weeks[0][0], null);
  assert.equal(weeks[0][4]?.date, "2026-01-01");
});
