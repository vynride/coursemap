import { Play, Plus } from "lucide-react";
import { fmt, type Job, type Moment } from "./api";
import { suggestionMoment } from "./course";

const STATUS = {
  covered: { label: "Taught", badge: "badge-green" },
  partial: { label: "Mentioned", badge: "badge-clay" },
  gap: { label: "Missing", badge: "badge-red" },
} as const;

const same = (a: Moment | null, b: Moment) => !!a && a.video_id === b.video_id && a.start_s === b.start_s;

export default function CoverageTab({ job, playing, onPlay }: {
  job: Job; playing: Moment | null; onPlay: (m: Moment) => void;
}) {
  const byTopic = new Map(job.coverage.map((c) => [c.topic_id, c]));
  return (
    <div className="stagger">
      {job.syllabus?.units.map((unit, i) => {
        const entries = unit.topics.map((t) => byTopic.get(t.id)).filter((e) => e !== undefined);
        const taught = entries.filter((e) => e.status === "covered").length;
        return (
          <section key={unit.id} className="card section">
            <div className="section-head">
              <div>
                <div className="eyebrow">Unit {i + 1}</div>
                <h3>{unit.title}</h3>
              </div>
              <span className="side-note">{taught} of {entries.length} taught</span>
            </div>
            <ul className="rows">
              {unit.topics.map((topic) => {
                const entry = byTopic.get(topic.id);
                if (!entry) return null;
                const suggestions = job.suggestions.filter((s) => s.topic_id === topic.id);
                return (
                  <li key={topic.id} className="row">
                    <div className="row-main">
                      <span className={`badge ${STATUS[entry.status].badge}`}>{STATUS[entry.status].label}</span>
                      <span className="row-title">{topic.name}</span>
                    </div>
                    {entry.moments.length > 0 && (
                      <div className="row-sub">
                        {entry.moments.map((m) => (
                          <button key={`${m.video_id}-${m.start_s}`} className={`stamp ${same(playing, m) ? "is-active" : ""}`}
                            title={m.video_title} onClick={() => onPlay(m)}>
                            <Play size={10} fill="currentColor" /> V{m.position + 1} · {fmt(m.start_s)}
                          </button>
                        ))}
                      </div>
                    )}
                    {entry.status === "gap" && suggestions.length > 0 && (
                      <div className="row-sub">
                        <span className="label">Fill the gap</span>
                        {suggestions.map((s) => (
                          <button key={s.video_id} className="suggestion" onClick={() => onPlay(suggestionMoment(s))}>
                            <Plus size={13} /> {s.title} <small>· {s.channel}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
