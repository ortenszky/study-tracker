import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_SESSION_SECONDS } from "@/lib/session-validation";

export const runtime = "nodejs";
const TIMER_ID = "primary";

export async function GET() {
  try {
    const timer = await prisma.activeTimer.findUnique({ where: { id: TIMER_ID }, include: { course: true } });
    return NextResponse.json(timer);
  } catch (error) {
    console.error("GET /api/timer error:", error);
    return NextResponse.json({ error: "Failed to restore the timer." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { courseId?: string };
    const courseId = body.courseId?.trim() ?? "";
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== "Active") {
      return NextResponse.json({ error: "Choose an active course." }, { status: 400 });
    }

    const existing = await prisma.activeTimer.findUnique({ where: { id: TIMER_ID } });
    if (existing) return NextResponse.json({ error: "A study timer is already running." }, { status: 409 });

    const timer = await prisma.activeTimer.create({
      data: { id: TIMER_ID, courseId, startTime: new Date() },
      include: { course: true },
    });
    return NextResponse.json(timer, { status: 201 });
  } catch (error) {
    console.error("POST /api/timer error:", error);
    return NextResponse.json({ error: "Failed to start the timer." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const save = new URL(request.url).searchParams.get("save") === "true";
    const timer = await prisma.activeTimer.findUnique({ where: { id: TIMER_ID }, include: { course: true } });
    if (!timer) return NextResponse.json({ error: "No timer is running." }, { status: 404 });

    if (!save) {
      await prisma.activeTimer.delete({ where: { id: TIMER_ID } });
      return NextResponse.json({ ok: true, saved: false });
    }

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - timer.startTime.getTime()) / 1000);
    if (durationSeconds <= 0 || durationSeconds > MAX_SESSION_SECONDS) {
      return NextResponse.json(
        { error: "This timer is outside the valid 1-second to 16-hour range. Cancel it and add the session manually." },
        { status: 400 }
      );
    }

    const overlap = await prisma.studySession.findFirst({
      where: { startTime: { lt: endTime }, endTime: { gt: timer.startTime } },
      select: { id: true },
    });
    if (overlap) return NextResponse.json({ error: "This timer overlaps an existing session." }, { status: 409 });

    const session = await prisma.$transaction(async (transaction) => {
      const created = await transaction.studySession.create({
        data: { courseId: timer.courseId, startTime: timer.startTime, endTime, durationSeconds },
        include: { course: true },
      });
      await transaction.activeTimer.delete({ where: { id: TIMER_ID } });
      return created;
    });
    return NextResponse.json({ ok: true, saved: true, session });
  } catch (error) {
    console.error("DELETE /api/timer error:", error);
    return NextResponse.json({ error: "Failed to stop the timer." }, { status: 500 });
  }
}
