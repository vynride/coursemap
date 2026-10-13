import { useState, type FormEvent } from "react";
import { createJob } from "./api";

const PRESETS = [
  { label: "Concepts + scenarios", text: "2-point short answers on concepts, then 5-point practical scenario questions." },
  { label: "Interview style", text: "5-point questions the way a technical interviewer would ask them, including \"how would you debug...\" and \"what happens when...\"." },
  { label: "Quick quiz", text: "1-point multiple-choice questions with four options, then 3-point short answers." },
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
    <form className="card form" onSubmit={submit}>
      <h1>Turn your YouTube playlist into a course</h1>
      <label>
        YouTube playlist link
        <input required value={playlist} onChange={(e) => setPlaylist(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=..." />
      </label>
      <label>
        Outline PDF (syllabus, roadmap or job description)
        <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
      </label>
      <label>
        …or paste the topics you want to learn
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Docker basics: images, containers, Dockerfile, volumes, networking, Compose…" />
      </label>
      <label>
        Test style
        <div className="presets">
          {PRESETS.map((p) => (
            <button type="button" key={p.label} className={pattern === p.text ? "on" : ""} onClick={() => setPattern(p.text)}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea rows={2} value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Starting…" : "Map my playlist"}</button>
    </form>
  );
}
