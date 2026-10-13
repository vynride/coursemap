import { Check, Circle, LoaderCircle, Map as MapIcon, NotebookPen, PenLine, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getJob, type Job, type Moment } from "./api";
import CoursePanel from "./CoursePanel";
import { videoMoment } from "./course";
import CoverageTab from "./CoverageTab";
import { fixtureJob } from "./fixture";
import NotesTab from "./NotesTab";
import Player from "./Player";
import PracticeTab from "./PracticeTab";
import { usePlan } from "./usePlan";

const STEPS: { status: Job["status"]; label: string }[] = [
  { status: "reading_syllabus", label: "Reading your outline" },
  { status: "fetching_playlist", label: "Fetching the playlist" },
  { status: "watching_videos", label: "Watching your videos" },
  { status: "writing_questions", label: "Writing practice questions" },
];

export default function JobView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(jobId === "fixture" ? fixtureJob : null);
  const [error, setError] = useState<string | null>(null);

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
  if (job.videos.length === 0) return <div className="card progress-card">This playlist has no videos we could watch.</div>;
  return <Course job={job} />;
}

type Tab = "map" | "notes" | "practice";

function Course({ job }: { job: Job }) {
  const plan = usePlan(job);
  const [tab, setTab] = useState<Tab>("map");
  const [playing, setPlaying] = useState<Moment>(() => videoMoment(job, [...job.videos].sort((a, b) => a.position - b.position)[0]));
  const [autoplay, setAutoplay] = useState(false);
  const [theatre, setTheatre] = useState(false);
  const [noteTarget, setNoteTarget] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);

  function play(m: Moment) {
    setPlaying({ ...m });   // a new object, so clicking the same moment again seeks again
    setAutoplay(true);
    // Bring the player into view when a timestamp far down the page is clicked.
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openPractice() {
    setTab("practice");
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openNotes(week: number) {
    setTab("notes");
    setNoteTarget(week);
  }

  return (
    <div className={`watch ${theatre ? "theatre" : ""}`}>
      <div className="watch-main" ref={stageRef}>
        <Player job={job} moment={playing} autoplay={autoplay} plan={plan} onPlay={play}
          theatre={theatre} onTheatre={() => setTheatre(!theatre)} />
        <nav className="tabs" ref={tabsRef}>
          <button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>
            <MapIcon size={15} strokeWidth={tab === "map" ? 2.2 : 1.8} /> Course map
          </button>
          <button className={tab === "notes" ? "on" : ""} onClick={() => { setTab("notes"); setNoteTarget(null); }}>
            <NotebookPen size={15} strokeWidth={tab === "notes" ? 2.2 : 1.8} /> Study notes
          </button>
          <button className={tab === "practice" ? "on" : ""} onClick={() => setTab("practice")}>
            <PenLine size={15} strokeWidth={tab === "practice" ? 2.2 : 1.8} /> Practice
            <span className="count">{job.questions.length}</span>
          </button>
        </nav>
        <div className="tab-body" key={tab}>
          {tab === "map" && <CoverageTab job={job} playing={playing} onPlay={play} />}
          {tab === "notes" && <NotesTab job={job} plan={plan} target={noteTarget} onPlay={play} onPractice={openPractice} />}
          {tab === "practice" && <PracticeTab job={job} onPlay={play} />}
        </div>
      </div>
      <aside className="watch-side">
        <CoursePanel job={job} plan={plan} currentVideo={playing.video_id} onPlay={play} onPractice={openPractice} onNotes={openNotes} />
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
