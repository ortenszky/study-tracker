ALTER TYPE "CourseStatus" ADD VALUE IF NOT EXISTS 'Planned' BEFORE 'Active';

ALTER TABLE "Course"
  ADD COLUMN "curriculumKey" TEXT,
  ADD COLUMN "ects" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "assessmentType" TEXT,
  ADD COLUMN "semester" INTEGER,
  ADD COLUMN "plannedStart" TIMESTAMP(3),
  ADD COLUMN "targetDate" TIMESTAMP(3),
  ADD COLUMN "weeklyTargetMinutes" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN "color" TEXT NOT NULL DEFAULT '#5B5BD6',
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "StudySession"
  ADD COLUMN "note" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ActiveTimer" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "courseId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActiveTimer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_curriculumKey_key" ON "Course"("curriculumKey");
CREATE INDEX "Course_status_idx" ON "Course"("status");
CREATE INDEX "Course_targetDate_idx" ON "Course"("targetDate");
CREATE UNIQUE INDEX "ActiveTimer_courseId_key" ON "ActiveTimer"("courseId");
ALTER TABLE "ActiveTimer" ADD CONSTRAINT "ActiveTimer_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
