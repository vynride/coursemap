import { useState, type FormEvent } from "react";
import { createJob } from "./api";

const PRESETS = [
  { label: "2 + 7 marks", text: "Part A: 2-mark short answers. Part B: 7-mark long answers." },
  { label: "2 + 5 + 10 marks", text: "Section A: 2 marks each. Section B: 5 marks each. Section C: 10 marks each." },
  { label: "MCQ + 5 marks", text: "1-mark MCQs with four options, then 5-mark short answers." },
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
      <h1>Is your playlist enough for your exam?</h1>
      <label>
        YouTube playlist link
        <input required value={playlist} onChange={(e) => setPlaylist(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=..." />
      </label>
      <label>
        Syllabus PDF
        <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
      </label>
      <label>
        …or paste the syllabus
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Unit 1: Introduction — process states, context switching…" />
      </label>
      <label>
        Exam pattern
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
