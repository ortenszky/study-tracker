export type AnalyticsSession = {
  id: string;
  courseId: string;
  title: string;
  color: string;
  startTime: Date;
  endTime: Date;
};

export type TimeBucket = "Morning" | "Afternoon" | "Evening" | "Night";

const QUARTER_HOUR_MS = 15 * 60 * 1000;

function dateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
function hourFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
}

export function assertTimeZone(timeZone: string): void {
  dateFormatter(timeZone).format(new Date());
}

export function getDateKey(date: Date, timeZone: string): string {
  return dateFormatter(timeZone).format(date);
}

function getHour(date: Date, timeZone: string): number {
  const value = Number(hourFormatter(timeZone).format(date));
  return value === 24 ? 0 : value;
}

function getBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 22) return "Evening";
  return "Night";
}

export function allocateSessions(sessions: AnalyticsSession[], timeZone: string) {
  assertTimeZone(timeZone);

  const secondsByDate = new Map<string, number>();
  const secondsByCourse = new Map<string, { courseId: string; title: string; color: string; seconds: number }>();
  const sessionIdsByDate = new Map<string, Set<string>>();
  const bucketSeconds: Record<TimeBucket, number> = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Night: 0,
  };

  let totalSeconds = 0;

  for (const session of sessions) {
    const startMs = session.startTime.getTime();
    const endMs = session.endTime.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

    let cursor = startMs;
    while (cursor < endMs) {
      const nextGridBoundary = (Math.floor(cursor / QUARTER_HOUR_MS) + 1) * QUARTER_HOUR_MS;
      const segmentEnd = Math.min(endMs, nextGridBoundary);
      const midpoint = new Date(cursor + (segmentEnd - cursor) / 2);
      const seconds = (segmentEnd - cursor) / 1000;
      const dateKey = getDateKey(midpoint, timeZone);
      const bucket = getBucket(getHour(midpoint, timeZone));

      totalSeconds += seconds;
      secondsByDate.set(dateKey, (secondsByDate.get(dateKey) ?? 0) + seconds);
      bucketSeconds[bucket] += seconds;

      const dateSessions = sessionIdsByDate.get(dateKey) ?? new Set<string>();
      dateSessions.add(session.id);
      sessionIdsByDate.set(dateKey, dateSessions);

      const course = secondsByCourse.get(session.courseId) ?? {
        courseId: session.courseId,
        title: session.title,
        color: session.color,
        seconds: 0,
      };
      course.seconds += seconds;
      secondsByCourse.set(session.courseId, course);
      cursor = segmentEnd;
    }
  }

  return { totalSeconds, secondsByDate, secondsByCourse, sessionIdsByDate, bucketSeconds };
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDateKeyDays(dateKey: string, days: number): string {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getLongestStreak(dateKeys: string[]): number {
  const sorted = Array.from(new Set(dateKeys)).sort();
  if (sorted.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = dateKeyToUtcDate(sorted[index - 1]).getTime();
    const next = dateKeyToUtcDate(sorted[index]).getTime();
    current = Math.round((next - previous) / 86_400_000) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function getHeatmapDays(year: number, secondsByDate: Map<string, number>) {
  const days: Array<{ date: string; seconds: number; hours: number; level: number }> = [];
  const current = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  while (current < end) {
    const date = current.toISOString().slice(0, 10);
    const seconds = Math.round(secondsByDate.get(date) ?? 0);
    const hours = seconds / 3600;
    const level = hours === 0 ? 0 : hours < 1 ? 1 : hours < 2 ? 2 : hours < 4 ? 3 : 4;
    days.push({ date, seconds, hours: Number(hours.toFixed(2)), level });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

export function getCalendarWeeks<T extends { date: string }>(days: T[]): Array<Array<T | null>> {
  if (days.length === 0) return [];
  const leading = dateKeyToUtcDate(days[0].date).getUTCDay();
  const padded: Array<T | null> = [...Array.from({ length: leading }, () => null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);
  return Array.from({ length: padded.length / 7 }, (_, index) => padded.slice(index * 7, index * 7 + 7));
}
