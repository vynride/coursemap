import { useState } from "react";
import { fmt, gradeAnswer, type Grade, type Job, type Moment, type Question } from "./api";

export default function PracticeTab({ job, onPlay }: { job: Job; onPlay: (m: Moment) => void }) {
  if (job.questions.length === 0) return <p className="muted">No questions were generated for this playlist.</p>;
  return (
    <div>
      {job.syllabus?.units.map((unit) => {
        const questions = job.questions.filter((q) => q.unit_id === unit.id);
        if (questions.length === 0) return null;
        return (
          <section key={unit.id} className="unit">
            <h3>{unit.id} · {unit.title}</h3>
            {questions.map((q) => <QuestionCard key={q.id} jobId={job.id} question={q} onPlay={onPlay} />)}
          </section>
        );
      })}
    </div>
  );
}

function QuestionCard({ jobId, question, onPlay }: { jobId: string; question: Question; onPlay: (m: Moment) => void }) {
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

  return (
    <div className="question card">
      <div className="qhead">
        <span className="marks">{question.marks} marks</span>
        {question.moment ? (
          <button className="link" onClick={() => onPlay(question.moment!)}>
            Taught in L{question.moment.position + 1} at {fmt(question.moment.start_s)}
          </button>
        ) : (
          <span className="muted">Not in your playlist</span>
        )}
      </div>
      <p>{question.text}</p>
      <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={5000}
        placeholder="Write your answer the way you would in the exam" />
      <div className="row">
        <button className="primary" onClick={check} disabled={busy}>{busy ? "Checking…" : "Check my answer"}</button>
        <button className="link" onClick={() => setShowPoints(!showPoints)}>
          {showPoints ? "Hide" : "Show"} what the examiner expects
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {showPoints && <ul>{question.answer_points.map((p) => <li key={p}>{p}</li>)}</ul>}
      {grade && (
        <div className="grade">
          <b>{grade.score} / {grade.max_score}.</b> {grade.feedback}
          {grade.missing_points.length > 0 && (
            <ul>{grade.missing_points.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          {grade.rewatch && (
            <button className="link" onClick={() => onPlay(grade.rewatch!)}>
              ▶ Rewatch where this is taught ({fmt(grade.rewatch.start_s)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
