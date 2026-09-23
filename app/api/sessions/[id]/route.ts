import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSessionTimes } from "@/lib/session-validation";

export const runtime = "nodejs";
type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const body = (await request.json()) as { startTime?: string; endTime?: string; note?: string };
    const parsed = parseSessionTimes(body.startTime, body.endTime);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const overlap = await prisma.studySession.findFirst({
      where: { id: { not: params.id }, startTime: { lt: parsed.endTime }, endTime: { gt: parsed.startTime } },
      select: { id: true },
    });
    if (overlap) return NextResponse.json({ error: "This overlaps another study session." }, { status: 409 });

    const session = await prisma.studySession.update({
      where: { id: params.id },
      data: {
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        durationSeconds: parsed.durationSeconds,
        ...(body.note !== undefined ? { note: body.note.trim().slice(0, 500) || null } : {}),
      },
      include: { course: true },
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to update session." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await prisma.studySession.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete session." }, { status: 500 });
  }
}
