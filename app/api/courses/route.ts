import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: [{ position: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("GET /api/courses error:", error);
    return NextResponse.json({ error: "Failed to fetch courses." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string; ects?: number; weeklyTargetMinutes?: number };
    const title = body.title?.trim() ?? "";
    if (!title || title.length > 120) {
      return NextResponse.json({ error: "Enter a course title of 1–120 characters." }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        title,
        ects: Math.min(30, Math.max(0, Math.round(body.ects ?? 5))),
        weeklyTargetMinutes: Math.min(2400, Math.max(30, Math.round(body.weeklyTargetMinutes ?? 300))),
        status: "Active",
      },
    });
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("POST /api/courses error:", error);
    return NextResponse.json({ error: "Failed to create course." }, { status: 500 });
  }
}
