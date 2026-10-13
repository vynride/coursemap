import { useEffect, useState } from "react";
import { getJob, type Job, type Moment } from "./api";
import CoverageTab from "./CoverageTab";
import { fixtureJob } from "./fixture";
import Player from "./Player";
import PracticeTab from "./PracticeTab";

const STEP_LABEL: Record<Job["status"], string> = {
  queued: "Starting…",
  reading_syllabus: "Reading your syllabus",
  fetching_playlist: "Fetching the playlist",
  watching_videos: "Watching your lectures",
  writing_questions: "Writing exam questions",
  done: "Done",
  failed: "Failed",
};

export default function JobView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(jobId === "fixture" ? fixtureJob : null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"map" | "practice">("map");
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

  if (!job) return <div className="card">{error ?? "Loading…"}</div>;
  if (job.status === "failed") {
    return (
      <div className="card error-card">
        <h2>Something went wrong</h2>
        <p>{job.error}</p>
        <a href="#/">Try again</a>
      </div>
    );
  }
  if (job.status !== "done") return <Progress job={job} />;

  return (
    <div className="job">
      <div className="main">
        <h1>{job.syllabus?.course}</h1>
        <Summary job={job} />
        <nav className="tabs">
          <button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>Syllabus map</button>
          <button className={tab === "practice" ? "on" : ""} onClick={() => setTab("practice")}>
            Practice ({job.questions.length})
          </button>
        </nav>
        {tab === "map" ? <CoverageTab job={job} onPlay={setPlaying} /> : <PracticeTab job={job} onPlay={setPlaying} />}
      </div>
      <aside className="side">
        <Player moment={playing} />
      </aside>
    </div>
  );
}

function Progress({ job }: { job: Job }) {
  const pct = job.progress_total ? Math.round((100 * job.progress_done) / job.progress_total) : 0;
  const topics = job.syllabus?.units.reduce((n, u) => n + u.topics.length, 0) ?? 0;
  return (
    <div className="card progress">
      <h2>{STEP_LABEL[job.status]}</h2>
      {job.syllabus && <p>{job.syllabus.course}: {job.syllabus.units.length} units, {topics} topics found</p>}
      {job.status === "watching_videos" && (
        <>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          <p>{job.progress_done} of {job.progress_total} lectures watched</p>
        </>
      )}
    </div>
  );
}

function Summary({ job }: { job: Job }) {
  const total = job.coverage.length;
  const count = (s: string) => job.coverage.filter((c) => c.status === s).length;
  return (
    <div className="summary">
      <div className="covered"><b>{total ? Math.round((100 * count("covered")) / total) : 0}%</b> of the syllabus is taught</div>
      <div className="partial"><b>{count("partial")}</b> topics only mentioned</div>
      <div className="gap"><b>{count("gap")}</b> topics missing</div>
      {job.skipped_videos.length > 0 && (
        <div className="muted" title={job.skipped_videos.map((s) => `${s.title}: ${s.reason}`).join("\n")}>
          <b>{job.skipped_videos.length}</b> videos skipped
        </div>
      )}
    </div>
  );
}
