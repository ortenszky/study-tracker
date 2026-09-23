import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSessionTimes } from "@/lib/session-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 50;
    const [items, total] = await Promise.all([
      prisma.studySession.findMany({
        include: { course: true },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.studySession.count(),
    ]);
    return NextResponse.json({ items, total, page, pageSize, hasMore: page * pageSize < total });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { courseId?: string; startTime?: string; endTime?: string; note?: string };
    const courseId = body.courseId?.trim() ?? "";
    const parsed = parseSessionTimes(body.startTime, body.endTime);
    if (!courseId) return NextResponse.json({ error: "Choose a course." }, { status: 400 });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const [course, overlap] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.studySession.findFirst({
        where: { startTime: { lt: parsed.endTime }, endTime: { gt: parsed.startTime } },
        select: { id: true },
      }),
    ]);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    if (course.status === "Finished") return NextResponse.json({ error: "Finished courses cannot receive new sessions." }, { status: 400 });
    if (overlap) return NextResponse.json({ error: "This overlaps another study session." }, { status: 409 });

    const session = await prisma.studySession.create({
      data: {
        courseId,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        durationSeconds: parsed.durationSeconds,
        note: body.note?.trim().slice(0, 500) || null,
      },
      include: { course: true },
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Failed to save session." }, { status: 500 });
  }
}
