import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import curriculum from "@/data/curriculum.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const aliases: Record<string, string[]> = {
  "explorative-data-analysis": ["Exploratory Data Analysis and Visualization"],
};

function courseData(item: (typeof curriculum)[number]) {
  return {
    title: item.title,
    ects: item.ects,
    assessmentType: item.assessmentType,
    semester: item.semester,
    plannedStart: new Date(`${item.plannedStart}T12:00:00.000Z`),
    targetDate: new Date(`${item.targetDate}T12:00:00.000Z`),
    weeklyTargetMinutes: item.weeklyTargetMinutes,
    color: item.color,
    position: item.position,
  };
}

export async function POST() {
  try {
    for (const item of curriculum) {
      await prisma.$transaction(async (transaction) => {
        const keyed = await transaction.course.findUnique({ where: { curriculumKey: item.key } });
        const legacy = await transaction.course.findFirst({
          where: {
            curriculumKey: null,
            title: { in: [item.title, ...(aliases[item.key] ?? [])], mode: "insensitive" },
          },
          orderBy: { createdAt: "asc" },
        });

        if (keyed && legacy) {
          await transaction.studySession.updateMany({ where: { courseId: keyed.id }, data: { courseId: legacy.id } });
          await transaction.activeTimer.updateMany({ where: { courseId: keyed.id }, data: { courseId: legacy.id } });
          await transaction.course.delete({ where: { id: keyed.id } });
          await transaction.course.update({ where: { id: legacy.id }, data: { ...courseData(item), curriculumKey: item.key } });
        } else if (legacy) {
          await transaction.course.update({ where: { id: legacy.id }, data: { ...courseData(item), curriculumKey: item.key } });
        } else if (keyed) {
          await transaction.course.update({ where: { id: keyed.id }, data: courseData(item) });
        } else {
          await transaction.course.create({
            data: { ...courseData(item), curriculumKey: item.key, status: item.initialStatus as "Planned" | "Active" },
          });
        }
      });
    }
    return NextResponse.json({ ok: true, courses: curriculum.length });
  } catch (error) {
    console.error("POST /api/plan error:", error);
    return NextResponse.json({ error: "Failed to load the curriculum plan." }, { status: 500 });
  }
}
