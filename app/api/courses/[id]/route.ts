import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const body = (await request.json()) as {
      status?: "Planned" | "Active" | "Finished";
      targetDate?: string | null;
      weeklyTargetMinutes?: number;
    };

    if (body.status && !["Planned", "Active", "Finished"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid course status." }, { status: 400 });
    }

    const targetDate = body.targetDate ? new Date(body.targetDate) : body.targetDate;
    if (targetDate instanceof Date && Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid target date." }, { status: 400 });
    }

    const course = await prisma.course.update({
      where: { id: params.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.targetDate !== undefined ? { targetDate } : {}),
        ...(body.weeklyTargetMinutes !== undefined
          ? { weeklyTargetMinutes: Math.min(2400, Math.max(30, Math.round(body.weeklyTargetMinutes))) }
          : {}),
      },
    });
    return NextResponse.json(course);
  } catch (error) {
    console.error("PATCH /api/courses/[id] error:", error);
    return NextResponse.json({ error: "Failed to update course." }, { status: 500 });
  }
}
