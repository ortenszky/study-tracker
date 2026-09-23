export type CourseStatus = "Planned" | "Active" | "Finished";

export type Course = {
  id: string;
  curriculumKey: string | null;
  title: string;
  status: CourseStatus;
  ects: number;
  assessmentType: string | null;
  semester: number | null;
  plannedStart: string | null;
  targetDate: string | null;
  weeklyTargetMinutes: number;
  color: string;
  position: number;
  createdAt: string;
};
export type Session = {
  id: string;
  courseId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  note: string | null;
  course: Course;
};

export type ActiveTimer = {
  id: string;
  courseId: string;
  startTime: string;
  course: Course;
};

export type HeatmapDay = { date: string; seconds: number; hours: number; level: number };

export type Stats = {
  totalStudySeconds: number;
  sessionsToday: number;
  focusEnduranceSeconds: number;
  longestStreakDays: number;
  currentWeekSeconds: number;
  weeklyGoalSeconds: number;
  weeklyGoalProgress: number;
  courseDistribution: Array<{ courseId: string; title: string; seconds: number; percentage: number; color: string }>;
  peakProductivity: Array<{ label: "Morning" | "Afternoon" | "Evening" | "Night"; seconds: number; hours: number }>;
  heatmap: HeatmapDay[];
  workload: { currentWeekSeconds: number; previousWeekSeconds: number; differenceSeconds: number; status: "up" | "stable" | "down"; message: string };
};
