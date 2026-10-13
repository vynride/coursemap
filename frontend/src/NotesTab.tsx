import { Check, ClipboardCheck, Copy, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { fmt, type Job, type Moment } from "./api";
import { suggestionMoment, videoMoment, videoTopics } from "./course";
import type { Week } from "./plan";
import type { Plan } from "./usePlan";

const DATE = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** One page of notes per study session (week), built from what each video teaches. */
export default function NotesTab({ job, plan, target, onPlay, onPractice }: {
  job: Job; plan: Plan; target: number | null; onPlay: (m: Moment) => void; onPractice: () => void;
}) {
  useEffect(() => {
    if (target !== null) document.getElementById(`session-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [target]);

  return (
    <div className="stagger">
      {plan.weeks.map((week) => (
        <Session key={week.index} job={job} week={week} done={plan.done} onPlay={onPlay} onPractice={onPractice} />
      ))}
    </div>
  );
}

function Session({ job, week, done, onPlay, onPractice }: {
  job: Job; week: Week; done: Set<string>; onPlay: (m: Moment) => void; onPractice: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const topicNames = [...new Set(week.videos.flatMap((v) => videoTopics(job, v.id).map((t) => t.name)))];
  const watched = week.videos.filter((v) => done.has(v.id)).length;

  async function copy() {
    const lines = [`# Session ${week.index} notes (${job.syllabus?.course ?? "Course"})`, ""];
    for (const v of week.videos) {
      lines.push(`## ${v.position + 1}. ${v.title}`);
      const summary = job.analyses.find((a) => a.video_id === v.id)?.summary;
      if (summary) lines.push(summary);
      for (const t of videoTopics(job, v.id)) {
        lines.push("", `**${t.name}** (${fmt(t.moment.start_s)}, https://youtu.be/${v.id}?t=${t.moment.start_s})`);
        lines.push(...t.moment.key_points.map((p) => `- ${p}`));
      }
      lines.push("");
    }
    if (week.gaps.length) lines.push("## Not in the playlist", ...week.gaps.map((s) => `- ${s.title}: https://youtu.be/${s.video_id}`));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: nothing to do
    }
  }

  return (
    <section id={`session-${week.index}`} className="card section notes">
      <div className="section-head">
        <div>
          <div className="eyebrow">Session {week.index} · due {DATE.format(week.due)} · {watched} of {week.videos.length} watched</div>
          <h3>{topicNames.length ? topicNames.slice(0, 3).join(", ") + (topicNames.length > 3 ? ` and ${topicNames.length - 3} more` : "") : "Session notes"}</h3>
        </div>
        <button className="btn-text" onClick={copy}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy as Markdown</>}
        </button>
      </div>

      {week.videos.map((v) => {
        const topics = videoTopics(job, v.id);
        const summary = job.analyses.find((a) => a.video_id === v.id)?.summary;
        return (
          <article key={v.id} className="note">
            <button className="note-title" onClick={() => onPlay(videoMoment(job, v))}>
              <span className="pl-num">{v.position + 1}</span> {v.title}
            </button>
            {summary && <p className="note-summary">{summary}</p>}
            {topics.length === 0 && <p className="note-summary muted">Nothing from your outline in this one.</p>}
            {topics.map((t) => (
              <div key={`${t.name}-${t.moment.start_s}`} className="note-topic">
                <div className="note-topic-head">
                  <button className="stamp" onClick={() => onPlay(t.moment)}>
                    <Play size={10} fill="currentColor" /> {fmt(t.moment.start_s)}
                  </button>
                  <b>{t.name}</b>
                  {t.moment.depth === "mentioned" && <span className="badge badge-clay">Mentioned</span>}
                </div>
                <ul>{t.moment.key_points.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            ))}
          </article>
        );
      })}

      {(week.gaps.length > 0 || week.tests.length > 0) && (
        <div className="note-foot">
          {week.gaps.length > 0 && (
            <div>
              <div className="eyebrow">Not in your playlist, watch these too</div>
              {week.gaps.map((s) => (
                <button key={s.video_id} className="suggestion" onClick={() => onPlay(suggestionMoment(s))}>
                  <Plus size={13} /> {s.title} <small>· {s.channel}</small>
                </button>
              ))}
            </div>
          )}
          {week.tests.length > 0 && (
            <div>
              <div className="eyebrow">Test yourself</div>
              {week.tests.map((u) => (
                <button key={u.id} className="suggestion" onClick={onPractice}>
                  <ClipboardCheck size={13} /> Unit test · {u.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
