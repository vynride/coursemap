import { fmt, type Job, type Moment, type Suggestion } from "./api";

const LABEL = { covered: "Taught", partial: "Mentioned", gap: "Missing" } as const;

function suggestionMoment(s: Suggestion): Moment {
  return {
    video_id: s.video_id, video_title: s.title, position: -1, start_s: 0, depth: "explained",
    key_points: [`Suggested video from ${s.channel}, not part of your playlist`],
  };
}

export default function CoverageTab({ job, onPlay }: { job: Job; onPlay: (m: Moment) => void }) {
  const byTopic = new Map(job.coverage.map((c) => [c.topic_id, c]));
  return (
    <div>
      {job.syllabus?.units.map((unit) => (
        <section key={unit.id} className="unit">
          <h3>{unit.id} · {unit.title}</h3>
          <ul>
            {unit.topics.map((topic) => {
              const entry = byTopic.get(topic.id);
              if (!entry) return null;
              const suggestions = job.suggestions.filter((s) => s.topic_id === topic.id);
              return (
                <li key={topic.id} className={`topic ${entry.status}`}>
                  <span className="chip">{LABEL[entry.status]}</span>
                  {topic.name}
                  {entry.moments.length > 0 && (
                    <div className="moments">
                      {entry.moments.map((m) => (
                        <button key={`${m.video_id}-${m.start_s}`} title={m.video_title} onClick={() => onPlay(m)}>
                          ▶ L{m.position + 1} {fmt(m.start_s)}
                        </button>
                      ))}
                    </div>
                  )}
                  {entry.status === "gap" && suggestions.length > 0 && (
                    <div className="suggest">
                      Not in your playlist. Try:
                      {suggestions.map((s) => (
                        <button key={s.video_id} onClick={() => onPlay(suggestionMoment(s))}>{s.title}</button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
