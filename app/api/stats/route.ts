import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDateKeyDays, allocateSessions, getDateKey, getHeatmapDays, getLongestStreak } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeZone = url.searchParams.get("tz") || "Europe/Budapest";
    const [sessions, activeCourses] = await Promise.all([
      prisma.studySession.findMany({ include: { course: true }, orderBy: { startTime: "asc" } }),
      prisma.course.findMany({ where: { status: "Active" }, select: { weeklyTargetMinutes: true } }),
    ]);

    const allocated = allocateSessions(
      sessions.map((session) => ({
        id: session.id,
        courseId: session.courseId,
        title: session.course.title,
        color: session.course.color,
        startTime: session.startTime,
        endTime: session.endTime,
      })),
      timeZone
    );

    const todayKey = getDateKey(new Date(), timeZone);
    const currentYear = Number(todayKey.slice(0, 4));
    const currentKeys = new Set(Array.from({ length: 7 }, (_, index) => addDateKeyDays(todayKey, -index)));
    const previousKeys = new Set(Array.from({ length: 7 }, (_, index) => addDateKeyDays(todayKey, -index - 7)));
    let currentWeekSeconds = 0;
    let previousWeekSeconds = 0;
    for (const [date, seconds] of allocated.secondsByDate) {
      if (currentKeys.has(date)) currentWeekSeconds += seconds;
      if (previousKeys.has(date)) previousWeekSeconds += seconds;
    }

    const totalStudySeconds = Math.round(allocated.totalSeconds);
    const weeklyGoalSeconds = activeCourses.reduce((sum, course) => sum + course.weeklyTargetMinutes * 60, 0);
    const differenceSeconds = Math.round(currentWeekSeconds - previousWeekSeconds);
    const changePercent = previousWeekSeconds === 0 ? null : (differenceSeconds / previousWeekSeconds) * 100;
    const workloadStatus = changePercent === null || Math.abs(changePercent) < 25 ? "stable" : changePercent > 0 ? "up" : "down";
    const workloadMessage =
      previousWeekSeconds === 0
        ? currentWeekSeconds > 0
          ? "A fresh week of progress—there is no previous-week baseline yet."
          : "Start a session to establish your weekly baseline."
        : workloadStatus === "up"
          ? "Study time is up by more than 25%. Keep the momentum, but protect recovery time."
          : workloadStatus === "down"
            ? "Study time is down by more than 25%. Rebalance the plan if this was not intentional."
            : "Your workload is steady compared with the previous seven days.";

    const courseDistribution = Array.from(allocated.secondsByCourse.values())
      .map((item) => ({
        ...item,
        seconds: Math.round(item.seconds),
        percentage: totalStudySeconds === 0 ? 0 : Number(((item.seconds / totalStudySeconds) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.seconds - a.seconds);

    return NextResponse.json({
      totalStudySeconds,
      sessionsToday: allocated.sessionIdsByDate.get(todayKey)?.size ?? 0,
      focusEnduranceSeconds: sessions.length === 0 ? 0 : Math.round(totalStudySeconds / sessions.length),
      longestStreakDays: getLongestStreak(Array.from(allocated.secondsByDate.keys())),
      currentWeekSeconds: Math.round(currentWeekSeconds),
      weeklyGoalSeconds,
      weeklyGoalProgress: weeklyGoalSeconds === 0 ? 0 : Math.round((currentWeekSeconds / weeklyGoalSeconds) * 100),
      courseDistribution,
      peakProductivity: (["Morning", "Afternoon", "Evening", "Night"] as const).map((label) => ({
        label,
        seconds: Math.round(allocated.bucketSeconds[label]),
        hours: Number((allocated.bucketSeconds[label] / 3600).toFixed(2)),
      })),
      heatmap: getHeatmapDays(currentYear, allocated.secondsByDate),
      workload: {
        currentWeekSeconds: Math.round(currentWeekSeconds),
        previousWeekSeconds: Math.round(previousWeekSeconds),
        differenceSeconds,
        status: workloadStatus,
        message: workloadMessage,
      },
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    if (error instanceof RangeError) return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
    return NextResponse.json({ error: "Failed to fetch statistics." }, { status: 500 });
  }
}
