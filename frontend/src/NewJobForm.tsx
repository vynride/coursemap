import { ArrowRight, CalendarDays, Clapperboard, FileUp, ListChecks, LoaderCircle, PenLine } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createJob } from "./api";

const PRESETS = [
  { label: "Concepts + scenarios", text: "2-point short answers on concepts, then 5-point practical scenario questions." },
  { label: "Interview style", text: "5-point questions the way a technical interviewer would ask them, including \"how would you debug...\" and \"what happens when...\"." },
  { label: "Quick quiz", text: "1-point multiple-choice questions with four options, then 3-point short answers." },
];

const STEPS = [
  { icon: Clapperboard, title: "Gemini watches every video", text: "Each outline topic is matched to the moment it is taught, with a timestamp." },
  { icon: ListChecks, title: "See what the playlist skips", text: "Topics are marked taught, only mentioned, or missing, with videos to fill the gaps." },
  { icon: CalendarDays, title: "Follow a study plan", text: "Weekly deadlines that fit the hours you have, with a test at the end of each unit." },
  { icon: PenLine, title: "Practise and get graded", text: "Write answers in your own words and jump back to the exact moment you got wrong." },
];

export default function NewJobForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [playlist, setPlaylist] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [pattern, setPattern] = useState(PRESETS[0].text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("playlist_url", playlist);
    form.append("exam_pattern", pattern);
    form.append("syllabus_text", text);
    if (pdf) form.append("syllabus_pdf", pdf);
    try {
      const { job_id } = await createJob(form);
      onCreated(job_id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <h1 className="hero-title">
        Turn your YouTube playlist into a course.
        <span>Know what it teaches, and what it skips.</span>
      </h1>
      <p className="hero-lede">
        Paste a playlist and the topics you want to learn. CourseMap maps every topic to the moment it is taught,
        plans your weeks, and tests you on it.
      </p>

      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">YouTube playlist link</span>
          <input className="input" required value={playlist} onChange={(e) => setPlaylist(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=..." />
        </label>

        <div className="field">
          <span className="field-label">
            What you want to learn <span className="field-hint">· a list of topics, a skill roadmap or a job description</span>
          </span>
          <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Docker basics: images, containers, Dockerfile, volumes, networking, Compose…" />
          <div className="or">or</div>
          <label className="file-drop">
            <FileUp size={18} />
            {pdf ? <span><b>{pdf.name}</b> · click to change</span> : <span>Upload an outline as PDF, such as a syllabus</span>}
            <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="field">
          <span className="field-label">Test style</span>
          <div className="segmented">
            {PRESETS.map((p) => (
              <button type="button" key={p.label} className={pattern === p.text ? "on" : ""} onClick={() => setPattern(p.text)}>
                {p.label}
              </button>
            ))}
          </div>
          <textarea className="input" rows={2} value={pattern} onChange={(e) => setPattern(e.target.value)} />
        </div>

        {error && <div className="notice-error">{error}</div>}
        <div className="form-foot">
          <span className="field-hint">Takes about a minute for a 10-video playlist.</span>
          <button className="btn-primary" disabled={busy}>
            {busy ? <><LoaderCircle size={16} className="spin" /> Starting</> : <>Build my course <ArrowRight size={16} /></>}
          </button>
        </div>
      </form>

      <div className="steps">
        <div className="eyebrow" style={{ marginBottom: 8 }}>How it works</div>
        {STEPS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="step-row">
            <Icon size={18} strokeWidth={1.8} />
            <div><b>{title}</b><span>{text}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
