import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.course.findFirst({
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Database touched successfully.",
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/keep-alive error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to touch database.",
      },
      { status: 500 }
    );
  }
}