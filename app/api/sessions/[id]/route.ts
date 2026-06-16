import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

type PatchBody = {
  startTime?: string;
  endTime?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;

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

    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    const session = await prisma.studySession.update({
      where: { id },
      data: { startTime, endTime, durationSeconds },
      include: { course: true },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to update session." },
      { status: 500 }
    );
  }
}
