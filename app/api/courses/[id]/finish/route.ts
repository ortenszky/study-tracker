import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const existingCourse = await prisma.course.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        status: "Finished",
      },
    });

    return NextResponse.json(updatedCourse);
  } catch (error) {
    console.error("PATCH /api/courses/[id]/finish error:", error);

    return NextResponse.json(
      { error: "Failed to finish course." },
      { status: 500 }
    );
  }
}