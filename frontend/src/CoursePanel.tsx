import { ClipboardCheck, Play, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { fmt, type Job, type Moment, type Suggestion, type Video } from "./api";
import { hours } from "./plan";
import type { Plan } from "./usePlan";

const DATE = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function videoMoment(video: Video): Moment {
  return { video_id: video.id, video_title: video.title, position: video.position, start_s: 0, depth: "explained", key_points: [] };
}

export function suggestionMoment(s: Suggestion): Moment {
  return {
    video_id: s.video_id, video_title: s.title, position: -1, start_s: 0, depth: "explained",
    key_points: [`From ${s.channel}. Not part of your playlist.`],
  };
}

/** Right-hand panel: course progress on top, the playlist as a weekly plan below (like YouTube's playlist panel). */
export default function CoursePanel({ job, plan, currentVideo, onPlay, onPractice }: {
  job: Job; plan: Plan; currentVideo: string | null; onPlay: (m: Moment) => void; onPractice: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { settings, setSettings, weeks, done, toggle, behind } = plan;
  const watched = job.videos.filter((v) => done.has(v.id)).length;
  const pctWatched = job.videos.length ? Math.round((100 * watched) / job.videos.length) : 0;

  const total = job.coverage.length;
  const count = (s: string) => job.coverage.filter((c) => c.status === s).length;
  const taught = count("covered");

  return (
    <div className="card panel">
      <div className="panel-head">
        <div className="eyebrow">Your course</div>
        <h2>{job.syllabus?.course}</h2>
        <p className="muted small">
          {job.videos.length} videos · {hours(job.videos.reduce((s, v) => s + v.duration_s, 0))}
          {job.skipped_videos.length > 0 && (
            <span title={job.skipped_videos.map((s) => `${s.title}: ${s.reason}`).join("\n")}> · {job.skipped_videos.length} skipped</span>
          )}
        </p>

        <div className="panel-progress">
          <div className="panel-progress-top">
            <b>{pctWatched}% complete</b>
            <span className={`badge ${behind ? "badge-red" : "badge-green"}`}>
              {behind ? `${behind} week${behind > 1 ? "s" : ""} behind` : "On track"}
            </span>
          </div>
          <div className="bar"><div style={{ width: `${pctWatched}%` }} /></div>
          <span className="muted small">
            {watched} of {job.videos.length} watched · finishes {weeks.length ? DATE.format(weeks[weeks.length - 1].due) : "—"}
          </span>
        </div>

        <div className="mini-stats">
          <div><b className="t-green">{total ? Math.round((100 * taught) / total) : 0}%</b><span>outline taught</span></div>
          <div><b className="t-clay">{count("partial")}</b><span>mentioned</span></div>
          <div><b className="t-red">{count("gap")}</b><span>missing</span></div>
        </div>

        <button className="btn-text" onClick={() => setEditing(!editing)}>
          <Settings2 size={14} /> {settings.hoursPerWeek} h a week from {DATE.format(new Date(`${settings.start}T00:00:00`))}
        </button>
        {editing && (
          <div className="plan-edit">
            <label className="field">
              <span className="field-label">Start date</span>
              <input className="input" type="date" value={settings.start}
                onChange={(e) => e.target.value && setSettings({ ...settings, start: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Hours per week</span>
              <input className="input" type="number" min={0.5} max={40} step={0.5} value={settings.hoursPerWeek}
                onChange={(e) => setSettings({ ...settings, hoursPerWeek: Number(e.target.value) || 3 })} />
            </label>
          </div>
        )}
      </div>

      <div className="panel-list">
        {weeks.map((week) => {
          const complete = week.videos.every((v) => done.has(v.id));
          const late = !complete && week.due < new Date();
          return (
            <div key={week.index} className="week-group">
              <div className="week-label">
                <span className="eyebrow">Week {week.index} · due {DATE.format(week.due)}</span>
                {complete ? <span className="badge badge-green">Done</span>
                  : late ? <span className="badge badge-red">Overdue</span>
                  : <span className="muted small">{hours(week.seconds)}</span>}
              </div>
              {week.videos.map((v) => {
                const active = v.id === currentVideo;
                return (
                  <div key={v.id} className={`pl-item ${active ? "is-active" : ""} ${done.has(v.id) ? "is-done" : ""}`}>
                    <input type="checkbox" className="check" checked={done.has(v.id)} onChange={() => toggle(v.id)}
                      aria-label={`Mark "${v.title}" as watched`} />
                    <button className="pl-main" onClick={() => onPlay(videoMoment(v))}>
                      <span className="pl-num">{active ? <Play size={11} fill="currentColor" /> : v.position + 1}</span>
                      <span className="pl-title">{v.title}</span>
                      <span className="pl-dur">{fmt(v.duration_s)}</span>
                    </button>
                  </div>
                );
              })}
              {week.gaps.map((s) => (
                <button key={s.video_id} className={`pl-extra ${s.video_id === currentVideo ? "is-active" : ""}`}
                  onClick={() => onPlay(suggestionMoment(s))}>
                  <Plus size={14} className="t-clay" />
                  <span className="pl-title">{s.title}</span>
                  <span className="badge badge-clay">Gap</span>
                </button>
              ))}
              {week.tests.map((u) => (
                <button key={u.id} className="pl-extra" onClick={onPractice}>
                  <ClipboardCheck size={14} className="t-green" />
                  <span className="pl-title">Unit test · {u.title}</span>
                  <span className="badge badge-green">Test</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
