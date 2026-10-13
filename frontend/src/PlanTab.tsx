import { useEffect, useMemo, useState } from "react";
import { fmt, type Job, type Moment, type Video } from "./api";
import { buildPlan, hours } from "./plan";

interface Settings { start: string; hoursPerWeek: number; done: string[] }

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function load(jobId: string): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(`coursemap:plan:${jobId}`) ?? "null");
    if (saved && typeof saved.start === "string") return saved;
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return { start: today(), hoursPerWeek: 3, done: [] };
}

function videoMoment(video: Video): Moment {
  return { video_id: video.id, video_title: video.title, position: video.position, start_s: 0, depth: "explained", key_points: [] };
}

const DATE = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function PlanTab({ job, onPlay, onPractice }: {
  job: Job; onPlay: (m: Moment) => void; onPractice: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(() => load(job.id));
  useEffect(() => {
    try {
      localStorage.setItem(`coursemap:plan:${job.id}`, JSON.stringify(settings));
    } catch {
      // progress just won't survive a reload
    }
  }, [job.id, settings]);

  const weeks = useMemo(
    () => buildPlan(job, new Date(`${settings.start}T00:00:00`), settings.hoursPerWeek),
    [job, settings.start, settings.hoursPerWeek],
  );
  const done = new Set(settings.done);
  const watched = job.videos.filter((v) => done.has(v.id)).length;
  const now = new Date();
  const behind = weeks.filter((w) => w.due < now && w.videos.some((v) => !done.has(v.id))).length;

  function toggle(id: string) {
    setSettings((s) => ({ ...s, done: s.done.includes(id) ? s.done.filter((x) => x !== id) : [...s.done, id] }));
  }

  if (weeks.length === 0) return <p className="muted">No videos to plan.</p>;
  return (
    <div>
      <div className="unit plan-settings">
        <label>Start date
          <input type="date" value={settings.start} onChange={(e) => e.target.value && setSettings({ ...settings, start: e.target.value })} />
        </label>
        <label>Hours per week
          <input type="number" min={0.5} max={40} step={0.5} value={settings.hoursPerWeek}
            onChange={(e) => setSettings({ ...settings, hoursPerWeek: Number(e.target.value) || 3 })} />
        </label>
        <div className="plan-status">
          <b>{watched} of {job.videos.length}</b> videos watched · {weeks.length} weeks, finishing {DATE.format(weeks[weeks.length - 1].due)}
          <div className={behind ? "late" : "ontrack"}>{behind ? `${behind} week${behind > 1 ? "s" : ""} behind` : "On track"}</div>
        </div>
      </div>
      {weeks.map((week) => {
        const complete = week.videos.every((v) => done.has(v.id));
        const late = !complete && week.due < now;
        return (
          <section key={week.index} className={`unit week ${complete ? "complete" : late ? "late" : ""}`}>
            <h3>Week {week.index} · due {DATE.format(week.due)} · {hours(week.seconds)}{complete ? " · done" : late ? " · overdue" : ""}</h3>
            <ul>
              {week.videos.map((v) => (
                <li key={v.id} className="plan-item">
                  <input type="checkbox" checked={done.has(v.id)} onChange={() => toggle(v.id)} aria-label={`Watched ${v.title}`} />
                  <button className="link" onClick={() => onPlay(videoMoment(v))}>{v.position + 1}. {v.title}</button>
                  <span className="muted">{fmt(v.duration_s)}</span>
                </li>
              ))}
              {week.gaps.map((s) => (
                <li key={s.video_id} className="plan-item extra">
                  <span className="chip">Gap</span>
                  <button className="link" onClick={() => onPlay({ ...videoMoment({ id: s.video_id, title: s.title, position: -1, duration_s: 0 }),
                    key_points: [`Suggested video from ${s.channel}, not part of your playlist`] })}>{s.title}</button>
                </li>
              ))}
              {week.tests.map((u) => (
                <li key={u.id} className="plan-item extra">
                  <span className="chip test">Test</span>
                  <button className="link" onClick={onPractice}>{u.id} · {u.title}</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
