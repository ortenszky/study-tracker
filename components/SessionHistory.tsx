"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Course, Session } from "@/lib/types";
import { formatHoursMinutes, toDatetimeLocal } from "@/lib/format";

type Props = {
  courses: Course[];
  sessions: Session[];
  hasMore: boolean;
  onChanged: () => Promise<void>;
  onLoadMore: () => Promise<void>;
};

export function SessionHistory({ courses, sessions, hasMore, onChanged, onLoadMore }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach((session) => {
      const label = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(session.startTime));
      map.set(label, [...(map.get(label) ?? []), session]);
    });
    return Array.from(map.entries());
  }, [sessions]);

  function beginEdit(session: Session) {
    setEditing(session.id);
    setStart(toDatetimeLocal(new Date(session.startTime)));
    setEnd(toDatetimeLocal(new Date(session.endTime)));
    setNote(session.note ?? "");
    setError("");
  }

  function beginManual() {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setStart(toDatetimeLocal(hourAgo));
    setEnd(toDatetimeLocal(now));
    setCourseId(courses.find((course) => course.status !== "Finished")?.id ?? "");
    setNote("");
    setManualOpen(true);
    setError("");
  }

  async function save(url: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save the session.");
      setEditing(null);
      setManualOpen(false);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the session.");
    } finally {
      setBusy(false);
    }
  }

  function isoValue(value: string): string | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function submitSession(url: string, method: "POST" | "PATCH", extra: Record<string, unknown> = {}) {
    const startTime = isoValue(start);
    const endTime = isoValue(end);
    if (!startTime || !endTime) {
      setError("Enter a valid start and end time.");
      return;
    }
    void save(url, method, { ...extra, startTime, endTime, note });
  }

  async function remove(sessionId: string) {
    if (!window.confirm("Delete this study session?")) return;
    setBusy(true);
    const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) await onChanged();
    else setError("Could not delete the session.");
  }

  const editor = (onSubmit: () => void, withCourse: boolean) => (
    <div className="session-editor">
      {withCourse ? <label><span>Course</span><select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.filter((course) => course.status !== "Finished").map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label> : null}
      <label><span>Start</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label><span>End</span><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      <label className="session-editor__note"><span>Note (optional)</span><input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="What did you work on?" /></label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="session-editor__actions"><button className="button button--ink" disabled={busy} onClick={onSubmit}>{busy ? "Saving…" : "Save session"}</button><button className="icon-button" onClick={() => { setEditing(null); setManualOpen(false); }} aria-label="Cancel"><X size={18} /></button></div>
    </div>
  );

  return (
    <section className="history-section" id="history">
      <div className="section-heading section-heading--compact">
        <div><p className="kicker">Evidence of effort</p><h2>Study log</h2></div>
        <button className="button button--outline" onClick={beginManual}><Plus size={17} /> Add session</button>
      </div>
      {manualOpen ? editor(() => submitSession("/api/sessions", "POST", { courseId }), true) : null}
      {groups.length === 0 ? <div className="history-empty">No sessions yet. Start the focus timer when you sit down to study.</div> : null}
      <div className="history-groups">
        {groups.map(([label, items]) => <div className="history-group" key={label}><h3>{label}</h3>{items.map((session) => (
          <div className="session-row" key={session.id}>
            {editing === session.id ? editor(() => submitSession(`/api/sessions/${session.id}`, "PATCH"), false) : <>
              <span className="session-color" style={{ background: session.course.color }} />
              <div className="session-main"><strong>{session.course.title}</strong><span>{new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(session.startTime))}–{new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(session.endTime))}{session.note ? ` · ${session.note}` : ""}</span></div>
              <strong className="session-duration">{formatHoursMinutes(session.durationSeconds)}</strong>
              <button className="icon-button" onClick={() => beginEdit(session)} aria-label="Edit session"><Pencil size={16} /></button>
              <button className="icon-button icon-button--danger" disabled={busy} onClick={() => void remove(session.id)} aria-label="Delete session"><Trash2 size={16} /></button>
            </>}
          </div>
        ))}</div>)}
      </div>
      {hasMore ? <button className="button button--outline history-more" onClick={() => void onLoadMore()}>Load older sessions</button> : null}
    </section>
  );
}
