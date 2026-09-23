"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, TimerReset } from "lucide-react";
import type { Stats } from "@/lib/types";
import { formatHoursMinutes } from "@/lib/format";
import { getCalendarWeeks } from "@/lib/analytics";

export function AnalyticsPanels({ stats }: { stats: Stats | null }) {
  const weeks = getCalendarWeeks(stats?.heatmap ?? []);
  const workloadIcon = stats?.workload.status === "up" ? <ArrowUpRight /> : stats?.workload.status === "down" ? <ArrowDownRight /> : <Minus />;

  return (
    <section className="analytics-section" id="insights">
      <div className="section-heading section-heading--compact">
        <div><p className="kicker">Patterns, not pressure</p><h2>Your study rhythm</h2></div>
        <p>All times respect your browser timezone. Long sessions are divided across the days and periods they actually cover.</p>
      </div>

      <div className="analytics-grid">
        <article className="chart-card">
          <div className="card-heading"><div><p className="kicker">All time</p><h3>Where the hours went</h3></div><strong>{formatHoursMinutes(stats?.totalStudySeconds ?? 0)}</strong></div>
          <div className="chart-space" role="img" aria-label="Study time distribution by course">
            {stats?.courseDistribution.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart><Pie data={stats.courseDistribution} dataKey="seconds" nameKey="title" innerRadius={68} outerRadius={104} paddingAngle={2}>
                  {stats.courseDistribution.map((item) => <Cell key={item.courseId} fill={item.color} />)}
                </Pie><Tooltip formatter={(value) => formatHoursMinutes(Number(value))} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-chart">Your first session will draw this chart.</div>}
          </div>
          <div className="legend-list">
            {stats?.courseDistribution.slice(0, 6).map((item) => <div key={item.courseId}><span style={{ background: item.color }} /><span>{item.title}</span><strong>{item.percentage}%</strong></div>)}
          </div>
        </article>

        <article className="chart-card">
          <div className="card-heading"><div><p className="kicker">Energy map</p><h3>When focus happens</h3></div><TimerReset /></div>
          <div className="chart-space" role="img" aria-label="Study time by time of day">
            {stats?.peakProductivity.some((item) => item.hours > 0) ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stats.peakProductivity} margin={{ top: 12, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#ddd6ca" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [`${value}h`, "Study time"]} />
                  <Bar dataKey="hours" fill="#5B5BD6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-chart">No time-of-day pattern yet.</div>}
          </div>
        </article>
      </div>

      <div className="rhythm-grid">
        <article className="heatmap-card">
          <div className="card-heading"><div><p className="kicker">Consistency</p><h3>{new Date().getFullYear()} in focus blocks</h3></div></div>
          <div className="heatmap-scroll">
            <div className="heatmap" aria-label="Yearly study heatmap">
              {weeks.map((week, weekIndex) => <div className="heatmap-week" key={weekIndex}>
                {week.map((day, dayIndex) => day ? (
                  <span key={day.date} className={`heatmap-day heatmap-day--${day.level}`} title={`${day.date}: ${formatHoursMinutes(day.seconds)}`} aria-label={`${day.date}, ${formatHoursMinutes(day.seconds)}`} />
                ) : <span className="heatmap-day heatmap-day--blank" key={`blank-${dayIndex}`} />)}
              </div>)}
            </div>
          </div>
          <div className="heatmap-key"><span>Less</span>{[0,1,2,3,4].map((level) => <i className={`heatmap-day heatmap-day--${level}`} key={level} />)}<span>More</span></div>
        </article>

        <article className={`workload-card workload-card--${stats?.workload.status ?? "stable"}`}>
          <div className="workload-icon">{workloadIcon}</div>
          <p className="kicker">Weekly workload trend</p>
          <h3>{formatHoursMinutes(stats?.workload.currentWeekSeconds ?? 0)}</h3>
          <p>{stats?.workload.message ?? "Study for a week to establish a baseline."}</p>
          <div className="workload-comparison">
            <span>Previous 7 days <strong>{formatHoursMinutes(stats?.workload.previousWeekSeconds ?? 0)}</strong></span>
            <span>Current 7 days <strong>{formatHoursMinutes(stats?.workload.currentWeekSeconds ?? 0)}</strong></span>
          </div>
        </article>
      </div>
    </section>
  );
}
