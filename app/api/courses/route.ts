import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      where: {
        status: "Active",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error("GET /api/courses error:", error);

    return NextResponse.json(
      { error: "Failed to fetch courses." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Course title is required." },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        title,
        status: "Active",
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("POST /api/courses error:", error);

    return NextResponse.json(
      { error: "Failed to create course." },
      { status: 500 }
    );
  }
}