import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Params = { params: { id: string } };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const course = await prisma.course.update({ where: { id: params.id }, data: { status: "Finished" } });
    return NextResponse.json(course);
  } catch (error) {
    console.error("PATCH /api/courses/[id]/finish error:", error);
    return NextResponse.json({ error: "Failed to finish course." }, { status: 500 });
  }
}
