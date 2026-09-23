const { PrismaClient } = require("@prisma/client");
const curriculum = require("../data/curriculum.json");

const prisma = new PrismaClient();
const aliases = {
  "explorative-data-analysis": ["Exploratory Data Analysis and Visualization"],
};

function courseData(item) {
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

async function reconcileCourse(item) {
  await prisma.$transaction(async (transaction) => {
    const keyed = await transaction.course.findUnique({ where: { curriculumKey: item.key } });
    const titles = [item.title, ...(aliases[item.key] ?? [])];
    const legacy = await transaction.course.findFirst({
      where: { curriculumKey: null, title: { in: titles, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });

    if (keyed && legacy) {
      await transaction.studySession.updateMany({ where: { courseId: keyed.id }, data: { courseId: legacy.id } });
      const keyedTimer = await transaction.activeTimer.findUnique({ where: { courseId: keyed.id } });
      if (keyedTimer) {
        await transaction.activeTimer.delete({ where: { id: keyedTimer.id } });
        await transaction.activeTimer.upsert({
          where: { id: "primary" },
          update: { courseId: legacy.id, startTime: keyedTimer.startTime },
          create: { id: "primary", courseId: legacy.id, startTime: keyedTimer.startTime },
        });
      }
      await transaction.course.delete({ where: { id: keyed.id } });
      await transaction.course.update({ where: { id: legacy.id }, data: { ...courseData(item), curriculumKey: item.key } });
      return;
    }

    if (legacy) {
      await transaction.course.update({ where: { id: legacy.id }, data: { ...courseData(item), curriculumKey: item.key } });
      return;
    }

    if (keyed) {
      await transaction.course.update({ where: { id: keyed.id }, data: courseData(item) });
      return;
    }

    await transaction.course.create({
      data: { ...courseData(item), curriculumKey: item.key, status: item.initialStatus },
    });
  });
}

async function main() {
  for (const item of curriculum) await reconcileCourse(item);
}

main()
  .then(() => console.log(`Reconciled ${curriculum.length} curriculum courses.`))
  .finally(() => prisma.$disconnect());
