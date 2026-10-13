import { Eye, EyeOff, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { fmt, gradeAnswer, type Grade, type Job, type Moment, type Question } from "./api";

const points = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;

export default function PracticeTab({ job, onPlay }: { job: Job; onPlay: (m: Moment) => void }) {
  if (job.questions.length === 0) return <div className="card empty">No questions were written for this playlist.</div>;
  return (
    <div className="stagger">
      {job.syllabus?.units.map((unit, i) => {
        const questions = job.questions.filter((q) => q.unit_id === unit.id);
        if (questions.length === 0) return null;
        const total = questions.reduce((s, q) => s + q.marks, 0);
        return (
          <section key={unit.id} className="card section">
            <div className="section-head">
              <div>
                <div className="eyebrow">Unit {i + 1} test</div>
                <h3>{unit.title}</h3>
              </div>
              <span className="side-note">{questions.length} questions · {points(total)}</span>
            </div>
            {questions.map((q, n) => <QuestionCard key={q.id} n={n + 1} jobId={job.id} question={q} onPlay={onPlay} />)}
          </section>
        );
      })}
    </div>
  );
}

function QuestionCard({ n, jobId, question, onPlay }: {
  n: number; jobId: string; question: Question; onPlay: (m: Moment) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPoints, setShowPoints] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      setGrade(await gradeAnswer(jobId, question.id, answer));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ratio = grade ? grade.score / grade.max_score : 0;
  return (
    <div className="question">
      <div className="question-head">
        <span className="eyebrow">Question {n} · {points(question.marks)}</span>
        {question.moment ? (
          <button className="stamp" title={question.moment.video_title} onClick={() => onPlay(question.moment!)}>
            <Play size={10} fill="currentColor" /> Taught in V{question.moment.position + 1} · {fmt(question.moment.start_s)}
          </button>
        ) : (
          <span className="badge badge-clay">Not in your playlist</span>
        )}
      </div>
      <p className="question-text">{question.text}</p>
      <textarea className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={5000}
        placeholder="Write your answer in your own words" />
      <div className="question-actions">
        <button className="btn-primary" onClick={check} disabled={busy || !answer.trim()}>
          {busy ? <><LoaderCircle size={15} className="spin" /> Checking</> : grade ? <><RotateCcw size={14} /> Check again</> : "Check my answer"}
        </button>
        <button className="btn-text" onClick={() => setShowPoints(!showPoints)}>
          {showPoints ? <EyeOff size={14} /> : <Eye size={14} />} {showPoints ? "Hide" : "Show"} what a good answer covers
        </button>
      </div>
      {error && <div className="notice-error" style={{ marginTop: 10 }}>{error}</div>}
      {showPoints && <ul className="expected">{question.answer_points.map((p) => <li key={p}>{p}</li>)}</ul>}
      {grade && (
        <div className={`grade ${ratio >= 0.8 ? "good" : ratio >= 0.4 ? "part" : "low"}`}>
          <div className="grade-top">
            <span className="score">{grade.score}<small> / {grade.max_score}</small></span>
            <p>{grade.feedback}</p>
          </div>
          {grade.missing_points.length > 0 && (
            <div className="missing">
              <div className="eyebrow">What your answer missed</div>
              <ul>{grade.missing_points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          {grade.rewatch && (
            <button className="btn-text" onClick={() => onPlay(grade.rewatch!)}>
              <Play size={12} fill="currentColor" /> Rewatch where this is taught · V{grade.rewatch.position + 1} at {fmt(grade.rewatch.start_s)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
