"use client";

import { CalendarDays, Check, Flag, Loader2 } from "lucide-react";
import type { Course, CourseStatus } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { useMemo, useState } from "react";

type Props = {
  courses: Course[];
  onChanged: () => Promise<void>;
};

const STATUS_LABEL: Record<CourseStatus, string> = { Planned: "Planned", Active: "In progress", Finished: "Done" };

export function StudyPlan({ courses, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState("");
  const curriculumCourses = courses.filter((course) => course.curriculumKey);
  const totalEcts = curriculumCourses.reduce((sum, course) => sum + course.ects, 0);
  const finishedEcts = curriculumCourses.filter((course) => course.status === "Finished").reduce((sum, course) => sum + course.ects, 0);
  const progress = totalEcts === 0 ? 0 : Math.round((finishedEcts / totalEcts) * 100);
  const semesters = useMemo(() => [4, 5, 6].map((semester) => ({ semester, courses: curriculumCourses.filter((course) => course.semester === semester) })), [curriculumCourses]);

  async function loadPlan() {
    setLoadingPlan(true);
    setError("");
    try {
      const response = await fetch("/api/plan", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load the plan.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the plan.");
    } finally {
      setLoadingPlan(false);
    }
  }

  async function updateCourse(courseId: string, body: Record<string, unknown>) {
    setBusyId(courseId);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the course.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the course.");
    } finally {
      setBusyId(null);
    }
  }

  if (curriculumCourses.length === 0) {
    return (
      <section className="plan-empty">
        <Flag size={32} />
        <div>
          <p className="kicker">Your finish plan</p>
          <h2>90 ECTS → July 2027</h2>
          <p>The curriculum is ready to load with dates, weekly targets, and a two-week retake buffer.</p>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <button className="button button--ink" onClick={loadPlan} disabled={loadingPlan}>
          {loadingPlan ? <Loader2 className="spin" size={18} /> : <Flag size={18} />} Load my 90 ECTS plan
        </button>
      </section>
    );
  }

  return (
    <section className="plan-section" id="plan">
      <div className="section-heading">
        <div>
          <p className="kicker">Roadmap</p>
          <h2>Finish line: July 15, 2027</h2>
          <p>July 16–31 stays deliberately empty for corrections, retakes, and breathing room.</p>
        </div>
        <div className="ects-progress">
          <strong>{finishedEcts}</strong><span> / {totalEcts} ECTS</span>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <small>{progress}% complete</small>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="semester-grid">
        {semesters.map(({ semester, courses: semesterCourses }) => (
          <article className="semester-column" key={semester}>
            <div className="semester-title"><span>0{semester}</span><div><p>Semester</p><strong>{semester}</strong></div></div>
            <div className="course-stack">
              {semesterCourses.map((course) => (
                <div className={`course-card course-card--${course.status.toLowerCase()}`} key={course.id} style={{ "--course-color": course.color } as React.CSSProperties}>
                  <div className="course-card__top">
                    <span className="status-dot" />
                    <span>{STATUS_LABEL[course.status]}</span>
                    <span className="course-card__ects">{course.ects} ECTS</span>
                  </div>
                  <h3>{course.title}</h3>
                  <div className="course-card__meta">
                    <span><CalendarDays size={14} /> {formatShortDate(course.targetDate)}</span>
                    <span>{course.assessmentType ?? "Elective"}</span>
                  </div>
                  <div className="course-card__controls">
                    <label>
                      <span>Deadline</span>
                      <input
                        type="date"
                        defaultValue={course.targetDate?.slice(0, 10) ?? ""}
                        onBlur={(event) => {
                          if (event.currentTarget.value && event.currentTarget.value !== course.targetDate?.slice(0, 10)) {
                            void updateCourse(course.id, { targetDate: `${event.currentTarget.value}T12:00:00.000Z` });
                          }
                        }}
                      />
                    </label>
                    <label>
                      <span>Hours / week</span>
                      <input
                        type="number"
                        min="0.5"
                        max="40"
                        step="0.5"
                        defaultValue={course.weeklyTargetMinutes / 60}
                        onBlur={(event) => void updateCourse(course.id, { weeklyTargetMinutes: Number(event.currentTarget.value) * 60 })}
                      />
                    </label>
                  </div>
                  <div className="course-card__actions">
                    {course.status !== "Active" ? <button onClick={() => void updateCourse(course.id, { status: "Active" })}>Start</button> : null}
                    {course.status !== "Finished" ? <button onClick={() => void updateCourse(course.id, { status: "Finished" })}><Check size={14} /> Complete</button> : null}
                    {course.status === "Finished" ? <button onClick={() => void updateCourse(course.id, { status: "Active" })}>Reopen</button> : null}
                    {busyId === course.id ? <Loader2 className="spin" size={15} /> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="thesis-track">
        <div><p className="kicker">Thesis parallel track</p><h3>Start early, finish calmly</h3></div>
        {["Topic · Jan 31", "Proposal · Feb 28", "Data & literature · Mar 31", "Analysis · May 15", "Full draft · Jun 20", "Submit · Jul 15"].map((milestone, index) => (
          <div className="thesis-step" key={milestone}><span>{index + 1}</span>{milestone}</div>
        ))}
      </div>
    </section>
  );
}
