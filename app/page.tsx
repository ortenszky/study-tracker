"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Flame,
  Plus,
  Timer,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Course = {
  id: string;
  title: string;
  status: "Active" | "Finished";
  createdAt: string;
};

type Session = {
  id: string;
  courseId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  course: Course;
};

type CourseDistributionItem = {
  courseId: string;
  title: string;
  seconds: number;
  percentage: number;
};

type PeakProductivityItem = {
  label: "Morning" | "Afternoon" | "Evening" | "Night";
  seconds: number;
  hours: number;
};

type HeatmapDay = {
  date: string;
  seconds: number;
  hours: number;
  level: number;
};

type Stats = {
  totalStudySeconds: number;
  sessionsToday: number;
  focusEnduranceSeconds: number;
  longestStreakDays: number;
  courseDistribution: CourseDistributionItem[];
  peakProductivity: PeakProductivityItem[];
  heatmap: HeatmapDay[];
  burnout: {
    currentWeekSeconds: number;
    previousWeekSeconds: number;
    differenceSeconds: number;
    status: "up" | "stable" | "down";
    message: string;
  };
};

type SavedTimerState = {
  isRunning: boolean;
  courseId: string;
  startTime: string;
};

const TIMER_STORAGE_KEY = "study-tracker-active-session";

const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
];

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(remainingSeconds).padStart(2, "0"),
  ].join(":");
}

function formatHoursMinutes(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getHeatmapClass(level: number): string {
  switch (level) {
    case 1:
      return "bg-emerald-900/80";
    case 2:
      return "bg-emerald-700";
    case 3:
      return "bg-emerald-500";
    case 4:
      return "bg-emerald-300";
    default:
      return "bg-slate-800";
  }
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
          {icon}
        </div>
      </div>

      {helper ? <p className="mt-3 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [newCourseTitle, setNewCourseTitle] = useState("");

  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [confirmingFinish, setConfirmingFinish] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId) ?? null;
  }, [courses, selectedCourseId]);

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, Session[]>();

    for (const session of sessions) {
      const label = new Date(session.startTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(session);
    }

    return Array.from(groups.entries()).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  }, [sessions]);

  async function fetchCourses() {
    const response = await fetch("/api/courses", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch courses.");
    }

    const data = (await response.json()) as Course[];
    setCourses(data);

    setSelectedCourseId((previous) => {
      if (previous && data.some((course) => course.id === previous)) {
        return previous;
      }

      return data[0]?.id ?? "";
    });
  }

  async function fetchStats() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const response = await fetch(`/api/stats?tz=${encodeURIComponent(timeZone)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch statistics.");
    }

    const data = (await response.json()) as Stats;
    setStats(data);
  }

  async function fetchSessions() {
    const response = await fetch("/api/sessions", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to fetch sessions.");
    }

    const data = (await response.json()) as Session[];
    setSessions(data);
  }

  async function refreshData() {
    await Promise.all([fetchCourses(), fetchStats(), fetchSessions()]);
  }

  useEffect(() => {
    refreshData().catch((error) => {
      console.error(error);
      setErrorMessage("Could not load dashboard data.");
    });
  }, []);

  useEffect(() => {
    const savedStateRaw = localStorage.getItem(TIMER_STORAGE_KEY);

    if (!savedStateRaw) {
      return;
    }

    try {
      const savedState = JSON.parse(savedStateRaw) as SavedTimerState;

      if (!savedState.isRunning || !savedState.startTime || !savedState.courseId) {
        return;
      }

      const restoredStartTime = new Date(savedState.startTime);

      if (Number.isNaN(restoredStartTime.getTime())) {
        localStorage.removeItem(TIMER_STORAGE_KEY);
        return;
      }

      setSelectedCourseId(savedState.courseId);
      setStartTime(restoredStartTime);
      setIsRunning(true);
      setElapsedSeconds(
        Math.floor((Date.now() - restoredStartTime.getTime()) / 1000)
      );
    } catch {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isRunning || !startTime) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, startTime]);

  function startSession() {
    if (!selectedCourseId) {
      setErrorMessage("Create or select an active course first.");
      return;
    }

    const now = new Date();

    setStartTime(now);
    setElapsedSeconds(0);
    setIsRunning(true);
    setErrorMessage("");

    const savedState: SavedTimerState = {
      isRunning: true,
      courseId: selectedCourseId,
      startTime: now.toISOString(),
    };

    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(savedState));
  }

  async function stopAndSaveSession() {
    if (!startTime || !selectedCourseId) {
      setErrorMessage("No active session to save.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      const endTime = new Date();

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: selectedCourseId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save session.");
      }

      setIsRunning(false);
      setStartTime(null);
      setElapsedSeconds(0);
      localStorage.removeItem(TIMER_STORAGE_KEY);

      await Promise.all([fetchStats(), fetchSessions()]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save session."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStartStop() {
    if (isRunning) {
      await stopAndSaveSession();
    } else {
      startSession();
    }
  }

  async function addCourse() {
    const title = newCourseTitle.trim();

    if (!title) {
      setErrorMessage("Course title cannot be empty.");
      return;
    }

    try {
      setErrorMessage("");

      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const createdCourse = (await response.json()) as Course | { error: string };

      if (!response.ok) {
        throw new Error("error" in createdCourse ? createdCourse.error : "Failed.");
      }

      setNewCourseTitle("");

      await fetchCourses();

      if ("id" in createdCourse) {
        setSelectedCourseId(createdCourse.id);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create course."
      );
    }
  }

  async function finishCourse() {
    if (!selectedCourseId) {
      setErrorMessage("Select a course first.");
      return;
    }

    if (isRunning) {
      setErrorMessage("Stop and save your session before finishing the course.");
      return;
    }

    try {
      setErrorMessage("");

      const response = await fetch(`/api/courses/${selectedCourseId}/finish`, {
        method: "PATCH",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to finish course.");
      }

      setConfirmingFinish(false);
      setSelectedCourseId("");
      await refreshData();
    } catch (error) {
      console.error(error);
      setConfirmingFinish(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to finish course."
      );
    }
  }

  function startEdit(session: Session) {
    setEditingSessionId(session.id);
    setEditStart(toDatetimeLocal(new Date(session.startTime)));
    setEditEnd(toDatetimeLocal(new Date(session.endTime)));
    setEditError("");
  }

  async function saveSessionEdit(sessionId: string) {
    try {
      setIsSavingEdit(true);
      setEditError("");

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: new Date(editStart).toISOString(),
          endTime: new Date(editEnd).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update session.");
      }

      setEditingSessionId(null);
      await Promise.all([fetchSessions(), fetchStats()]);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Failed to update session."
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  const burnoutBadgeClass =
    stats?.burnout.status === "down"
      ? "border-red-400/30 bg-red-400/10 text-red-300"
      : stats?.burnout.status === "up"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
        : "border-blue-400/30 bg-blue-400/10 text-blue-300";

  const heatmapDays = stats?.heatmap ?? [];

  const heatmapWeeks = Array.from(
    { length: Math.ceil(heatmapDays.length / 7) },
    (_, weekIndex) => heatmapDays.slice(weekIndex * 7, weekIndex * 7 + 7)
  );

  const monthLabels = heatmapWeeks.map((week, weekIndex) => {
    const firstDayOfMonth = week.find((day) => day.date.endsWith("-01"));

    if (!firstDayOfMonth && weekIndex !== 0) {
      return "";
    }

    const labelDay = firstDayOfMonth ?? week[0];

    if (!labelDay) {
      return "";
    }

    return new Date(`${labelDay.date}T00:00:00`).toLocaleString("en-US", {
      month: "short",
    });
  });

  return (
      <main className="min-h-screen w-full overflow-x-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-8">
            <div
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
              <Activity size={16}/>
              Study Tracker Dashboard
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Track focus. Build momentum.
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              Real-time study sessions, course analytics, streaks, heatmap
              intensity, and workload signals in one modern dashboard.
            </p>
          </header>

          <section className="grid w-full min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active session</p>
                  <h2 className="text-xl font-semibold text-white">Controller</h2>
                </div>

                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-3 text-blue-300">
                  <Timer/>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Add course
                  </label>

                  <div className="flex gap-2">
                    <input
                        value={newCourseTitle}
                        onChange={(event) => setNewCourseTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            addCourse();
                          }
                        }}
                        placeholder="e.g. Statistics"
                        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-400"
                    />

                    <button
                        onClick={addCourse}
                        className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-emerald-300 transition hover:bg-emerald-400/20"
                        aria-label="Add course"
                    >
                      <Plus size={18}/>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Select active course
                  </label>

                  <select
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                      disabled={isRunning}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {courses.length === 0 ? (
                        <option value="">No active courses</option>
                    ) : (
                        courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                        ))
                    )}
                  </select>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    {selectedCourse?.title ?? "No course selected"}
                  </p>

                  <div className="mt-4 font-mono text-5xl font-bold tracking-tight text-white">
                    {formatDuration(elapsedSeconds)}
                  </div>

                  <div
                      className={`mx-auto mt-5 h-3 w-3 rounded-full ${
                          isRunning
                              ? "bg-emerald-400 shadow-lg shadow-emerald-400/60"
                              : "bg-slate-600"
                      }`}
                  />
                </div>

                {errorMessage ? (
                    <p className="text-xs text-red-400">{errorMessage}</p>
                ) : null}

                <button
                    onClick={handleStartStop}
                    disabled={isSaving || courses.length === 0}
                    className={`w-full rounded-2xl px-4 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isRunning
                            ? "bg-red-500 hover:bg-red-400"
                            : "bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-400 hover:to-blue-400"
                    }`}
                >
                  {isRunning
                      ? isSaving
                          ? "Saving..."
                          : "Stop & Save"
                      : "Start Study Session"}
                </button>

                {confirmingFinish ? (
                    <div className="space-y-2">
                      <p className="text-center text-sm text-slate-400">
                        Archive &ldquo;{selectedCourse?.title}&rdquo;?
                      </p>

                      <div className="flex gap-2">
                        <button
                            onClick={finishCourse}
                            className="flex-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
                        >
                          Yes, finish
                        </button>

                        <button
                            onClick={() => setConfirmingFinish(false)}
                            className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmingFinish(true)}
                        disabled={!selectedCourseId || isRunning}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Finish Course
                    </button>
                )}
              </div>
            </aside>

            <section className="min-w-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={<BookOpen size={22}/>}
                    label="Total study time"
                    value={formatHoursMinutes(stats?.totalStudySeconds ?? 0)}
                    helper="All saved sessions"
                />

                <StatCard
                    icon={<BarChart3 size={22}/>}
                    label="Sessions today"
                    value={String(stats?.sessionsToday ?? 0)}
                    helper="Based on your local timezone"
                />

                <StatCard
                    icon={<Timer size={22}/>}
                    label="Focus endurance"
                    value={formatHoursMinutes(stats?.focusEnduranceSeconds ?? 0)}
                    helper="Average session length"
                />

                <StatCard
                    icon={<Trophy size={22}/>}
                    label="Longest streak"
                    value={`${stats?.longestStreakDays ?? 0} days`}
                    helper="Best consecutive-day run"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Distribution</p>
                      <h3 className="text-xl font-semibold text-white">
                        Time by course
                      </h3>
                    </div>
                  </div>

                  <div className="h-72">
                    {stats && stats.courseDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                                data={stats.courseDistribution}
                                dataKey="seconds"
                                nameKey="title"
                                innerRadius={65}
                                outerRadius={105}
                                paddingAngle={3}
                            >
                              {stats.courseDistribution.map((entry, index) => (
                                  <Cell
                                      key={entry.courseId}
                                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                                  />
                              ))}
                            </Pie>

                            <Tooltip
                                formatter={(value, _name, props) => {
                                  const seconds =
                                      typeof value === "number"
                                          ? value
                                          : Number(value ?? 0);

                                  const payload = props.payload as {
                                    title?: string;
                                    percentage?: number;
                                  };

                                  return [
                                    formatHoursMinutes(seconds),
                                    `${payload.title ?? "Course"} (${
                                        payload.percentage ?? 0
                                    }%)`,
                                  ];
                                }}
                                contentStyle={{
                                  background: "#020617",
                                  border: "1px solid #1e293b",
                                  borderRadius: "12px",
                                  color: "#ffffff",
                                }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          Save sessions to see course distribution.
                        </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {stats?.courseDistribution.map((course, index) => (
                        <div
                            key={course.courseId}
                            className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                        <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                  CHART_COLORS[index % CHART_COLORS.length],
                            }}
                        />
                            <span className="text-slate-300">{course.title}</span>
                          </div>

                          <span className="text-slate-500">
                        {course.percentage}%
                      </span>
                        </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
                  <div className="mb-4">
                    <p className="text-sm text-slate-400">Peak productivity</p>
                    <h3 className="text-xl font-semibold text-white">
                      Most active time of day
                    </h3>
                  </div>

                  <div className="h-72">
                    {stats &&
                    stats.peakProductivity.some((item) => item.hours > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.peakProductivity}>
                            <XAxis
                                dataKey="label"
                                stroke="#64748b"
                                tickLine={false}
                                axisLine={false}
                            />

                            <YAxis
                                stroke="#64748b"
                                tickLine={false}
                                axisLine={false}
                            />

                            <Tooltip
                                formatter={(value) => {
                                  const hours =
                                      typeof value === "number"
                                          ? value
                                          : Number(value ?? 0);

                                  return [`${hours}h`, "Study time"];
                                }}
                                contentStyle={{
                                  background: "#020617",
                                  border: "1px solid #1e293b",
                                  borderRadius: "12px",
                                  color: "#ffffff",
                                }}
                            />

                            <Bar
                                dataKey="hours"
                                radius={[10, 10, 0, 0]}
                                fill="#38bdf8"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          Save sessions to see productivity patterns.
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                  className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-black/20 sm:p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-slate-400">Consistency</p>
                    <h3 className="text-xl font-semibold text-white">
                      GitHub-style study heatmap
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Less</span>
                    <span className="h-3 w-3 rounded-sm bg-slate-800"/>
                    <span className="h-3 w-3 rounded-sm bg-emerald-900/80"/>
                    <span className="h-3 w-3 rounded-sm bg-emerald-700"/>
                    <span className="h-3 w-3 rounded-sm bg-emerald-500"/>
                    <span className="h-3 w-3 rounded-sm bg-emerald-300"/>
                    <span>More</span>
                  </div>
                </div>

                <div className="w-full max-w-full overflow-x-auto pb-2">
                  <div className="w-max min-w-[720px]">
                    <div className="mb-2 ml-10 grid grid-flow-col gap-1">
                      {monthLabels.map((label, index) => (
                          <div
                              key={`${label}-${index}`}
                              className="h-4 w-3 text-xs text-slate-400"
                          >
                            {label}
                          </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <div className="grid grid-rows-7 gap-1 text-xs text-slate-400">
                        <div className="h-3"/>
                        <div className="flex h-3 items-center">Mon</div>
                        <div className="h-3"/>
                        <div className="flex h-3 items-center">Wed</div>
                        <div className="h-3"/>
                        <div className="flex h-3 items-center">Fri</div>
                        <div className="h-3"/>
                      </div>

                      <div className="grid grid-flow-col gap-1">
                        {heatmapWeeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-rows-7 gap-1">
                              {week.map((day) => (
                                  <div
                                      key={day.date}
                                      title={`${day.date}: ${day.hours}h`}
                                      className={`h-3 w-3 rounded-sm ${getHeatmapClass(
                                          day.level
                                      )}`}
                                  />
                              ))}
                            </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Flame className="text-orange-300" size={20}/>
                      <h3 className="text-xl font-semibold text-white">
                        Burnout predictor
                      </h3>
                    </div>

                    <p className="max-w-3xl text-sm text-slate-400">
                      {stats?.burnout.message ??
                          "Save study sessions to compare this week with the previous 7 days."}
                    </p>
                  </div>

                  <div
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${burnoutBadgeClass}`}
                  >
                    {stats
                        ? `${formatHoursMinutes(
                            stats.burnout.currentWeekSeconds
                        )} this week`
                        : "No data yet"}
                  </div>
                </div>

                {stats ? (
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-950 p-4">
                        <p className="text-slate-500">Current 7 days</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {formatHoursMinutes(stats.burnout.currentWeekSeconds)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-950 p-4">
                        <p className="text-slate-500">Previous 7 days</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {formatHoursMinutes(stats.burnout.previousWeekSeconds)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-950 p-4">
                        <p className="text-slate-500">Difference</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {stats.burnout.differenceSeconds >= 0 ? "+" : "-"}
                          {formatHoursMinutes(
                              Math.abs(stats.burnout.differenceSeconds)
                          )}
                        </p>
                      </div>
                    </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
                <div className="mb-4">
                  <p className="text-sm text-slate-400">History</p>
                  <h3 className="text-xl font-semibold text-white">Study sessions</h3>
                </div>

                {sessions.length === 0 ? (
                    <p className="text-sm text-slate-500">No sessions recorded yet.</p>
                ) : (
                    <div>
                      {groupedSessions.map(({ dateLabel, items }, groupIndex) => (
                          <div key={dateLabel}>
                            <p
                                className={`mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                                    groupIndex > 0 ? "mt-5" : ""
                                }`}
                            >
                              {dateLabel}
                            </p>

                            <div className="space-y-1">
                              {items.map((session) => (
                                  <div
                                      key={session.id}
                                      className="rounded-xl bg-slate-950 px-3 py-2"
                                  >
                                    {editingSessionId === session.id ? (
                                        <div className="space-y-3">
                                          <div className="flex flex-wrap gap-3">
                                            <div>
                                              <label className="mb-1 block text-xs text-slate-500">
                                                Start
                                              </label>
                                              <input
                                                  type="datetime-local"
                                                  value={editStart}
                                                  onChange={(e) => setEditStart(e.target.value)}
                                                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:border-emerald-400"
                                              />
                                            </div>

                                            <div>
                                              <label className="mb-1 block text-xs text-slate-500">
                                                End
                                              </label>
                                              <input
                                                  type="datetime-local"
                                                  value={editEnd}
                                                  onChange={(e) => setEditEnd(e.target.value)}
                                                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:border-emerald-400"
                                              />
                                            </div>
                                          </div>

                                          {editError ? (
                                              <p className="text-xs text-red-400">{editError}</p>
                                          ) : null}

                                          <div className="flex gap-2">
                                            <button
                                                onClick={() => saveSessionEdit(session.id)}
                                                disabled={isSavingEdit}
                                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                                            >
                                              {isSavingEdit ? "Saving…" : "Save"}
                                            </button>

                                            <button
                                                onClick={() => setEditingSessionId(null)}
                                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-4">
                                          <div className="flex min-w-0 items-center gap-3">
                                            <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                                              {session.course.title}
                                            </span>

                                            <span className="truncate text-sm text-slate-400">
                                              {new Date(session.startTime).toLocaleTimeString("en-US", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                              {" → "}
                                              {new Date(session.endTime).toLocaleTimeString("en-US", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </span>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-3">
                                            <span className="text-sm text-slate-500">
                                              {formatHoursMinutes(session.durationSeconds)}
                                            </span>

                                            <button
                                                onClick={() => startEdit(session)}
                                                className="text-xs text-slate-500 transition hover:text-emerald-300"
                                            >
                                              Edit
                                            </button>
                                          </div>
                                        </div>
                                    )}
                                  </div>
                              ))}
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
            </section>
          </section>
        </div>
      </main>
  );
}
