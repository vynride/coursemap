import { ClipboardCheck, Plus } from "lucide-react";
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

  if (weeks.length === 0) return <div className="card empty">There are no videos to plan.</div>;
  return (
    <div>
      <div className="card plan-controls">
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
        <div className="plan-status">
          <span className={`badge ${behind ? "badge-red" : "badge-green"}`}>
            {behind ? `${behind} week${behind > 1 ? "s" : ""} behind` : "On track"}
          </span>
          <b style={{ marginTop: 6 }}>{watched} of {job.videos.length} videos watched</b>
          <span>{weeks.length} weeks · finishes {DATE.format(weeks[weeks.length - 1].due)}</span>
        </div>
      </div>

      <div className="stagger">
        {weeks.map((week) => {
          const complete = week.videos.every((v) => done.has(v.id));
          const late = !complete && week.due < now;
          return (
            <section key={week.index} className={`card section week ${complete ? "is-done" : late ? "is-late" : ""}`}>
              <div className="section-head">
                <div>
                  <div className="eyebrow">Week {week.index} · due {DATE.format(week.due)}</div>
                  <h3>{week.videos.length} video{week.videos.length > 1 ? "s" : ""} · {hours(week.seconds)}</h3>
                </div>
                {complete ? <span className="badge badge-green">Done</span>
                  : late ? <span className="badge badge-red">Overdue</span>
                  : <span className="side-note">{week.videos.filter((v) => done.has(v.id)).length} of {week.videos.length} watched</span>}
              </div>
              {week.videos.map((v) => (
                <div key={v.id} className={`plan-row ${done.has(v.id) ? "is-checked" : ""}`}>
                  <input type="checkbox" className="check" checked={done.has(v.id)} onChange={() => toggle(v.id)}
                    aria-label={`Mark "${v.title}" as watched`} />
                  <button className="row-title" onClick={() => onPlay(videoMoment(v))}>{v.title}</button>
                  <span className="mono">{fmt(v.duration_s)}</span>
                </div>
              ))}
              {week.gaps.map((s) => (
                <div key={s.video_id} className="plan-row">
                  <span className="slot"><Plus size={15} color="var(--accent)" /></span>
                  <button className="row-title" onClick={() => onPlay({
                    video_id: s.video_id, video_title: s.title, position: -1, start_s: 0, depth: "explained",
                    key_points: [`From ${s.channel}. Not part of your playlist.`],
                  })}>{s.title}</button>
                  <span className="badge badge-clay">Gap</span>
                </div>
              ))}
              {week.tests.map((u) => (
                <div key={u.id} className="plan-row">
                  <span className="slot"><ClipboardCheck size={15} color="var(--primary)" /></span>
                  <button className="row-title" onClick={onPractice}>Unit test: {u.title}</button>
                  <span className="badge badge-green">Test</span>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
