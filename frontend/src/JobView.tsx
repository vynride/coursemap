import { CalendarDays, Check, Circle, ListChecks, LoaderCircle, Map as MapIcon, PenLine, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { getJob, type Job, type Moment } from "./api";
import CoverageTab from "./CoverageTab";
import { fixtureJob } from "./fixture";
import PlanTab from "./PlanTab";
import Player from "./Player";
import PracticeTab from "./PracticeTab";

const STEPS: { status: Job["status"]; label: string }[] = [
  { status: "reading_syllabus", label: "Reading your outline" },
  { status: "fetching_playlist", label: "Fetching the playlist" },
  { status: "watching_videos", label: "Watching your videos" },
  { status: "writing_questions", label: "Writing practice questions" },
];

type Tab = "map" | "plan" | "practice";

export default function JobView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(jobId === "fixture" ? fixtureJob : null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [playing, setPlaying] = useState<Moment | null>(null);

  useEffect(() => {
    if (jobId === "fixture") return;
    let stopped = false;
    let timer: number | undefined;
    async function poll() {
      try {
        const next = await getJob(jobId);
        if (stopped) return;
        setJob(next);
        setError(null);
        if (next.status !== "done" && next.status !== "failed") timer = window.setTimeout(poll, 2000);
      } catch (err) {
        if (stopped) return;
        setError((err as Error).message);
        timer = window.setTimeout(poll, 4000);
      }
    }
    poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [jobId]);

  if (!job) {
    return (
      <div className="card progress-card">
        {error ? <div className="notice-error">{error}</div> : <span className="shimmer-text">Loading</span>}
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="card progress-card">
        <span className="badge badge-red"><TriangleAlert size={12} /> Failed</span>
        <h2>We couldn't build this course</h2>
        <div className="notice-error">{job.error}</div>
        <a href="#/" className="btn-outline" style={{ marginTop: 16 }}>Try again</a>
      </div>
    );
  }
  if (job.status !== "done") return <Progress job={job} />;

  const tabs: { id: Tab; label: string; icon: typeof MapIcon; count?: number }[] = [
    { id: "map", label: "Course map", icon: MapIcon },
    { id: "plan", label: "Study plan", icon: CalendarDays },
    { id: "practice", label: "Practice", icon: PenLine, count: job.questions.length },
  ];

  return (
    <div className="job">
      <div>
        <Header job={job} />
        <nav className="tabs">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              <Icon size={15} strokeWidth={tab === id ? 2.2 : 1.8} /> {label}
              {count !== undefined && <span className="count">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="tab-body" key={tab}>
          {tab === "map" && <CoverageTab job={job} playing={playing} onPlay={setPlaying} />}
          {tab === "plan" && <PlanTab job={job} onPlay={setPlaying} onPractice={() => setTab("practice")} />}
          {tab === "practice" && <PracticeTab job={job} onPlay={setPlaying} />}
        </div>
      </div>
      <aside className="side">
        <Player moment={playing} />
      </aside>
    </div>
  );
}

function Progress({ job }: { job: Job }) {
  const current = STEPS.findIndex((s) => s.status === job.status);
  const pct = job.progress_total ? Math.round((100 * job.progress_done) / job.progress_total) : 0;
  const topics = job.syllabus?.units.reduce((n, u) => n + u.topics.length, 0) ?? 0;
  return (
    <div className="card progress-card">
      <div className="eyebrow">Building your course</div>
      <h2>{job.syllabus?.course ?? "Getting started"}</h2>
      <ul className="progress-list">
        {STEPS.map((step, i) => {
          const state = current > i ? "done" : current === i ? "now" : "todo";
          const detail =
            step.status === "reading_syllabus" && job.syllabus ? `${job.syllabus.units.length} units, ${topics} topics`
            : step.status === "watching_videos" && job.progress_total ? `${job.progress_done} of ${job.progress_total}`
            : null;
          return (
            <li key={step.status} className={state}>
              {state === "done" ? <Check size={16} strokeWidth={2.4} />
                : state === "now" ? <LoaderCircle size={16} className="spin" />
                : <Circle size={16} strokeWidth={1.5} />}
              <span className={state === "now" ? "shimmer-text" : ""}>{step.label}</span>
              {detail && <span className="detail">{detail}</span>}
            </li>
          );
        })}
      </ul>
      {job.status === "watching_videos" && <div className="bar"><div style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

function Header({ job }: { job: Job }) {
  const total = job.coverage.length;
  const count = (s: string) => job.coverage.filter((c) => c.status === s).length;
  const taught = count("covered"), mentioned = count("partial"), missing = count("gap");
  const pct = (n: number) => (total ? (100 * n) / total : 0);
  const hours = job.videos.reduce((s, v) => s + v.duration_s, 0) / 3600;
  return (
    <div className="job-head">
      <div className="eyebrow">Course map</div>
      <h1>{job.syllabus?.course}</h1>
      <p>
        {job.videos.length} videos · {hours.toFixed(1)} hours · {job.syllabus?.units.length} units
        {job.skipped_videos.length > 0 && (
          <span title={job.skipped_videos.map((s) => `${s.title}: ${s.reason}`).join("\n")}>
            {" "}· {job.skipped_videos.length} skipped
          </span>
        )}
      </p>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="stats">
          <div className="stat"><b>{Math.round(pct(taught))}%</b><span>of the outline taught</span></div>
          <div className="stat taught"><b>{taught}</b><span>topics taught</span></div>
          <div className="stat mentioned"><b>{mentioned}</b><span>only mentioned</span></div>
          <div className="stat missing"><b>{missing}</b><span>missing</span></div>
        </div>
        <div className="meter" aria-hidden>
          <i className="m-taught" style={{ width: `${pct(taught)}%` }} />
          <i className="m-mentioned" style={{ width: `${pct(mentioned)}%` }} />
          <i className="m-missing" style={{ width: `${pct(missing)}%` }} />
        </div>
      </div>
      {missing > 0 && (
        <p style={{ marginTop: 12 }}>
          <ListChecks size={14} style={{ verticalAlign: -2, marginRight: 6, color: "var(--accent)" }} />
          {missing === 1 ? "One topic isn't" : `${missing} topics aren't`} in your playlist.{job.suggestions.length > 0 && " The course map suggests videos to fill the gaps."}
        </p>
      )}
    </div>
  );
}
