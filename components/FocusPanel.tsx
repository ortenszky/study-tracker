"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleStop, Play, RotateCcw, Sparkles } from "lucide-react";
import type { ActiveTimer, Course } from "@/lib/types";
import { formatDuration } from "@/lib/format";

type Props = {
  courses: Course[];
  timer: ActiveTimer | null;
  onChanged: () => Promise<void>;
};

export function FocusPanel({ courses, timer, onChanged }: Props) {
  const activeCourses = useMemo(() => courses.filter((course) => course.status === "Active"), [courses]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (timer) setSelectedCourseId(timer.courseId);
    else if (!activeCourses.some((course) => course.id === selectedCourseId)) setSelectedCourseId(activeCourses[0]?.id ?? "");
  }, [activeCourses, selectedCourseId, timer]);

  useEffect(() => {
    if (!timer) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  async function request(url: string, options: RequestInit) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The timer could not be updated.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The timer could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="focus-panel">
      <div className="focus-panel__eyebrow"><Sparkles size={15} /> Focus room</div>
      <h2>{timer ? timer.course.title : "What are we moving forward?"}</h2>
      <p className="focus-panel__copy">One honest session at a time. The timer is saved in the database, so closing the tab will not lose it.</p>

      <div className="focus-clock" aria-live="polite">{formatDuration(elapsed)}</div>

      <label className="field-label" htmlFor="focus-course">Course</label>
      <select
        id="focus-course"
        value={selectedCourseId}
        onChange={(event) => setSelectedCourseId(event.target.value)}
        disabled={Boolean(timer) || busy}
        className="field-control field-control--dark"
      >
        {activeCourses.length === 0 ? <option value="">Activate a course in the plan</option> : null}
        {activeCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
      </select>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {!timer ? (
        <button
          className="focus-primary"
          disabled={!selectedCourseId || busy}
          onClick={() => request("/api/timer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: selectedCourseId }) })}
        >
          <Play size={18} fill="currentColor" /> {busy ? "Starting…" : "Start focus session"}
        </button>
      ) : (
        <div className="focus-actions">
          <button className="focus-primary" disabled={busy} onClick={() => request("/api/timer?save=true", { method: "DELETE" })}>
            <CircleStop size={18} /> {busy ? "Saving…" : "Stop & save"}
          </button>
          <button className="focus-secondary" disabled={busy} onClick={() => request("/api/timer?save=false", { method: "DELETE" })}>
            <RotateCcw size={16} /> Cancel
          </button>
        </div>
      )}
    </aside>
  );
}
