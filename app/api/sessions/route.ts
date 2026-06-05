import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const courseId = String(body.courseId ?? "");
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required." },
        { status: 400 }
      );
    }

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: "Valid startTime and endTime are required." },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
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