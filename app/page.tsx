"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarCheck, Clock3, Flame, Plus, Target } from "lucide-react";
import { FocusPanel } from "@/components/FocusPanel";
import { StudyPlan } from "@/components/StudyPlan";
import { AnalyticsPanels } from "@/components/AnalyticsPanels";
import { SessionHistory } from "@/components/SessionHistory";
import { formatHoursMinutes } from "@/lib/format";
import type { ActiveTimer, Course, Session, Stats } from "@/lib/types";

type SessionPage = { items: Session[]; total: number; page: number; pageSize: number; hasMore: boolean };

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [sessionPage, setSessionPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [coursesResponse, statsResponse, sessionsResponse, timerResponse] = await Promise.all([
      fetch("/api/courses", { cache: "no-store" }),
      fetch(`/api/stats?tz=${encodeURIComponent(timeZone)}`, { cache: "no-store" }),
      fetch("/api/sessions?page=1", { cache: "no-store" }),
      fetch("/api/timer", { cache: "no-store" }),
    ]);
    if (![coursesResponse, statsResponse, sessionsResponse, timerResponse].every((response) => response.ok)) {
      throw new Error("The dashboard could not be loaded. Check the database migration and connection.");
    }
    const sessionData = (await sessionsResponse.json()) as SessionPage;
    setCourses((await coursesResponse.json()) as Course[]);
    setStats((await statsResponse.json()) as Stats);
    setSessions(sessionData.items);
    setHasMore(sessionData.hasMore);
    setSessionPage(1);
    setTimer((await timerResponse.json()) as ActiveTimer | null);
    setError("");
  }, []);

  useEffect(() => {
    fetchDashboard()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "The dashboard could not be loaded."))
      .finally(() => setLoading(false));
  }, [fetchDashboard]);

  const curriculum = courses.filter((course) => course.curriculumKey);
  const finishedEcts = curriculum.filter((course) => course.status === "Finished").reduce((sum, course) => sum + course.ects, 0);
  const nextCourse = useMemo(() => courses.filter((course) => course.status !== "Finished" && course.targetDate).sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())[0], [courses]);
  const daysRemaining = Math.max(0, Math.ceil((new Date("2027-07-15T23:59:59").getTime() - Date.now()) / 86_400_000));

  async function loadMoreSessions() {
    const nextPage = sessionPage + 1;
    const response = await fetch(`/api/sessions?page=${nextPage}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as SessionPage;
    setSessions((current) => [...current, ...data.items]);
    setHasMore(data.hasMore);
    setSessionPage(nextPage);
  }

  async function addCourse() {
    const title = newCourse.trim();
    if (!title) return;
    setAddingCourse(true);
    const response = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setAddingCourse(false);
    if (response.ok) {
      setNewCourse("");
      await fetchDashboard();
    } else {
      const data = await response.json();
      setError(data.error ?? "Could not add the course.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top"><span>ST</span> Study trajectory</a>
        <nav aria-label="Dashboard sections"><a href="#plan">Plan</a><a href="#insights">Insights</a><a href="#history">Study log</a></nav>
        <div className="header-deadline"><CalendarCheck size={17} /> July 15, 2027</div>
      </header>

      <div id="top" className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-label">The final stretch · 90 ECTS</p>
            <h1>Make the finish line <em>visible.</em></h1>
            <p className="hero-intro">A realistic path through your final three semesters—with the thesis started early and two quiet weeks left for anything that slips.</p>
            <a className="hero-link" href="#plan">See the complete plan <ArrowRight size={18} /></a>
          </div>
          <div className="hero-number"><strong>{daysRemaining}</strong><span>days to<br />submission target</span></div>
        </section>

        {error ? <div className="global-error" role="alert">{error}</div> : null}
        {loading ? <div className="loading-state">Building your dashboard…</div> : null}

        {!loading ? (
          <>
            <section className="command-grid">
              <FocusPanel courses={courses} timer={timer} onChanged={fetchDashboard} />
              <div className="progress-zone">
                <div className="progress-zone__heading"><div><p className="kicker">Right now</p><h2>Momentum dashboard</h2></div><span className="live-pill"><i /> Private workspace</span></div>
                <div className="stat-grid">
                  <div className="stat-tile stat-tile--feature"><Target /><span>Weekly target</span><strong>{stats?.weeklyGoalProgress ?? 0}%</strong><div className="progress-track"><i style={{ width: `${Math.min(100, stats?.weeklyGoalProgress ?? 0)}%` }} /></div><small>{formatHoursMinutes(stats?.currentWeekSeconds ?? 0)} of {formatHoursMinutes(stats?.weeklyGoalSeconds ?? 0)}</small></div>
                  <div className="stat-tile"><BookOpen /><span>Curriculum</span><strong>{finishedEcts}<small> / 90 ECTS</small></strong></div>
                  <div className="stat-tile"><Clock3 /><span>All-time focus</span><strong>{formatHoursMinutes(stats?.totalStudySeconds ?? 0)}</strong></div>
                  <div className="stat-tile"><Flame /><span>Longest streak</span><strong>{stats?.longestStreakDays ?? 0}<small> days</small></strong></div>
                </div>
                <div className="next-deadline">
                  <span style={{ background: nextCourse?.color ?? "#1e293b" }}><CalendarCheck size={18} /></span>
                  <div><small>Next planned finish</small><strong>{nextCourse?.title ?? "Load the curriculum plan"}</strong></div>
                  <b>{nextCourse?.targetDate ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(nextCourse.targetDate)) : "—"}</b>
                </div>
                <div className="quick-course">
                  <label htmlFor="new-course">Something outside the curriculum?</label>
                  <div><input id="new-course" value={newCourse} onChange={(event) => setNewCourse(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addCourse(); }} placeholder="Add a custom course" /><button onClick={() => void addCourse()} disabled={addingCourse || !newCourse.trim()} aria-label="Add custom course"><Plus size={18} /></button></div>
                </div>
              </div>
            </section>

            <StudyPlan courses={courses} onChanged={fetchDashboard} />
            <AnalyticsPanels stats={stats} />
            <SessionHistory courses={courses} sessions={sessions} hasMore={hasMore} onChanged={fetchDashboard} onLoadMore={loadMoreSessions} />
          </>
        ) : null}
      </div>

      <footer><span>Study trajectory</span><p>Built for steady progress, not perfect weeks.</p></footer>
    </main>
  );
}
