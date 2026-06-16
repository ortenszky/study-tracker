import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CourseDistributionItem = {
  courseId: string;
  title: string;
  seconds: number;
  percentage: number;
};

type PeakProductivityItem = {
  label: "Night" | "Morning" | "Afternoon" | "Evening";
  seconds: number;
  hours: number;
};

type HeatmapDay = {
  date: string;
  seconds: number;
  hours: number;
  level: number;
};

function getDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function getHour(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });

  return Number(formatter.format(date));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function diffDays(a: string, b: string): number {
  const first = dateKeyToUtcDate(a).getTime();
  const second = dateKeyToUtcDate(b).getTime();

  return Math.round((second - first) / 86_400_000);
}

function formatDateKeyFromParts(year: number, month: number, day: number): string {
  const yyyy = String(year);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getYearFromDateKey(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

function getHeatmapDays(
  year: number,
  secondsByDate: Map<string, number>
): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const current = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  while (current < end) {
    const dateKey = current.toISOString().slice(0, 10);
    const seconds = secondsByDate.get(dateKey) ?? 0;
    const hours = seconds / 3600;

    let level = 0;

    if (hours > 0 && hours < 1) level = 1;
    else if (hours >= 1 && hours < 2) level = 2;
    else if (hours >= 2 && hours < 4) level = 3;
    else if (hours >= 4) level = 4;

    days.push({
      date: dateKey,
      seconds,
      hours: Number(hours.toFixed(2)),
      level,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function getLongestStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;

  const sorted = Array.from(new Set(dateKeys)).sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const difference = diffDays(sorted[i - 1], sorted[i]);

    if (difference === 1) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
  }

  return longest;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeZone = url.searchParams.get("tz") || "Europe/Zurich";

    const now = new Date();
    const todayKey = getDateKey(now, timeZone);
    const currentYear = getYearFromDateKey(todayKey);

    const startOfCurrentYear = new Date(Date.UTC(currentYear, 0, 1));
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
    const queryLowerBound = new Date(
      Math.min(startOfCurrentYear.getTime(), fourteenDaysAgo.getTime())
    );

    const [allSessions, recentSessions] = await Promise.all([
      prisma.studySession.findMany({
        select: { durationSeconds: true },
      }),
      prisma.studySession.findMany({
        where: { startTime: { gte: queryLowerBound } },
        include: { course: true },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const totalStudySeconds = allSessions.reduce(
      (sum, session) => sum + session.durationSeconds,
      0
    );

    const sessionsToday = recentSessions.filter(
      (session) => getDateKey(session.startTime, timeZone) === todayKey
    ).length;

    const focusEnduranceSeconds =
      allSessions.length === 0
        ? 0
        : Math.round(totalStudySeconds / allSessions.length);

    const secondsByCourse = new Map<
      string,
      {
        courseId: string;
        title: string;
        seconds: number;
      }
    >();

    const secondsByDate = new Map<string, number>();

    const bucketSeconds: Record<
      "Night" | "Morning" | "Afternoon" | "Evening",
      number
    > = {
      Night: 0,
      Morning: 0,
      Afternoon: 0,
      Evening: 0,
    };

    for (const session of recentSessions) {
      const existingCourse = secondsByCourse.get(session.courseId);

      if (existingCourse) {
        existingCourse.seconds += session.durationSeconds;
      } else {
        secondsByCourse.set(session.courseId, {
          courseId: session.courseId,
          title: session.course.title,
          seconds: session.durationSeconds,
        });
      }

      const dateKey = getDateKey(session.startTime, timeZone);
      secondsByDate.set(
        dateKey,
        (secondsByDate.get(dateKey) ?? 0) + session.durationSeconds
      );

      const hour = getHour(session.startTime, timeZone);

      if (hour >= 5 && hour < 12) {
        bucketSeconds.Morning += session.durationSeconds;
      } else if (hour >= 12 && hour < 17) {
        bucketSeconds.Afternoon += session.durationSeconds;
      } else if (hour >= 17 && hour < 22) {
        bucketSeconds.Evening += session.durationSeconds;
      } else {
        bucketSeconds.Night += session.durationSeconds;
      }
    }

    const courseDistribution: CourseDistributionItem[] = Array.from(
      secondsByCourse.values()
    )
      .map((item) => ({
        ...item,
        percentage:
          totalStudySeconds === 0
            ? 0
            : Number(((item.seconds / totalStudySeconds) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const peakProductivity: PeakProductivityItem[] = (
      ["Morning", "Afternoon", "Evening", "Night"] as const
    ).map((label) => ({
      label,
      seconds: bucketSeconds[label],
      hours: Number((bucketSeconds[label] / 3600).toFixed(2)),
    }));

    const dateKeysWithSessions = Array.from(secondsByDate.keys());
    const longestStreakDays = getLongestStreak(dateKeysWithSessions);

    const heatmap = getHeatmapDays(currentYear, secondsByDate);

    const currentSevenDayKeys = new Set<string>();
    const previousSevenDayKeys = new Set<string>();

    for (let i = 0; i < 7; i++) {
      currentSevenDayKeys.add(getDateKey(addDays(now, -i), timeZone));
    }

    for (let i = 7; i < 14; i++) {
      previousSevenDayKeys.add(getDateKey(addDays(now, -i), timeZone));
    }

    let currentWeekSeconds = 0;
    let previousWeekSeconds = 0;

    for (const [dateKey, seconds] of Array.from(secondsByDate.entries())) {
      if (currentSevenDayKeys.has(dateKey)) {
        currentWeekSeconds += seconds;
      }

      if (previousSevenDayKeys.has(dateKey)) {
        previousWeekSeconds += seconds;
      }
    }

    const burnoutDifferenceSeconds = currentWeekSeconds - previousWeekSeconds;

    let burnoutStatus: "up" | "stable" | "down" = "stable";
    let burnoutMessage =
      "Your focus time is stable compared with the previous 7 days.";

    if (previousWeekSeconds === 0 && currentWeekSeconds > 0) {
      burnoutStatus = "up";
      burnoutMessage =
        "You studied this week, but there was no study time in the previous 7 days.";
    } else if (previousWeekSeconds > 0) {
      const changePercent =
        (burnoutDifferenceSeconds / previousWeekSeconds) * 100;

      if (changePercent <= -25) {
        burnoutStatus = "down";
        burnoutMessage =
          "Your study time dropped by more than 25% compared with the previous 7 days. Consider checking your workload, sleep, and recovery.";
      } else if (changePercent >= 25) {
        burnoutStatus = "up";
        burnoutMessage =
          "Your study time increased by more than 25% compared with the previous 7 days. Great momentum, but keep recovery in mind.";
      }
    }

    return NextResponse.json({
      totalStudySeconds,
      sessionsToday,
      focusEnduranceSeconds,
      longestStreakDays,
      courseDistribution,
      peakProductivity,
      heatmap,
      burnout: {
        currentWeekSeconds,
        previousWeekSeconds,
        differenceSeconds: burnoutDifferenceSeconds,
        status: burnoutStatus,
        message: burnoutMessage,
      },
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);

    return NextResponse.json(
      { error: "Failed to fetch statistics." },
      { status: 500 }
    );
  }
}