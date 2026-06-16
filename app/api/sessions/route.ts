import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await prisma.studySession.findMany({
      include: { course: true },
      orderBy: { startTime: "desc" },
      take: 100,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET /api/sessions error:", error);

    return NextResponse.json(
      { error: "Failed to fetch sessions." },
      { status: 500 }
    );
  }
}

type CreateSessionBody = {
  courseId?: string;
  startTime?: string;
  endTime?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSessionBody;

    const courseId = body.courseId?.trim() ?? "";
    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required." },
        { status: 400 }
      );
    }

    if (
      !startTime ||
      !endTime ||
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime())
    ) {
      return NextResponse.json(
        { error: "Valid startTime and endTime are required." },
        { status: 400 }
      );
    }

    if (endTime.getTime() <= startTime.getTime()) {
      return NextResponse.json(
        { error: "endTime must be after startTime." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: {
        id: courseId,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    if (course.status !== "Active") {
      return NextResponse.json(
        { error: "Cannot save a session for a finished course." },
        { status: 400 }
      );
    }

    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    const session = await prisma.studySession.create({
      data: {
        courseId,
        startTime,
        endTime,
        durationSeconds,
      },
      include: {
        course: true,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);

    return NextResponse.json(
      { error: "Failed to save session." },
      { status: 500 }
    );
  }
}