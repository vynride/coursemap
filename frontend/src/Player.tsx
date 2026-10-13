import { Check, Play } from "lucide-react";
import { fmt, type Job, type Moment } from "./api";
import type { Plan } from "./usePlan";

/** The main stage: the video, what it is, and the outline topics it teaches with jump-to timestamps. */
export default function Player({ job, moment, autoplay, plan, onPlay }: {
  job: Job; moment: Moment; autoplay: boolean; plan: Plan; onPlay: (m: Moment) => void;
}) {
  const inPlaylist = moment.position >= 0;
  const topics = job.coverage
    .flatMap((c) => c.moments.filter((m) => m.video_id === moment.video_id).map((m) => ({ name: c.topic_name, m })))
    .sort((a, b) => a.m.start_s - b.m.start_s);
  const summary = job.analyses.find((a) => a.video_id === moment.video_id)?.summary;
  const watched = plan.done.has(moment.video_id);

  return (
    <div className="stage">
      <div className="stage-video">
        <iframe
          key={`${moment.video_id}-${moment.start_s}`}
          src={`https://www.youtube.com/embed/${moment.video_id}?start=${moment.start_s}&autoplay=${autoplay ? 1 : 0}&rel=0`}
          title={moment.video_title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="stage-meta">
        <div className="stage-title">
          <div>
            <div className="eyebrow">
              {inPlaylist ? `Video ${moment.position + 1} of ${job.videos.length}` : "Suggested video · not in your playlist"}
              {moment.start_s > 0 && ` · from ${fmt(moment.start_s)}`}
            </div>
            <h1>{moment.video_title}</h1>
          </div>
          {inPlaylist && (
            <button className={watched ? "btn-outline is-on" : "btn-outline"} onClick={() => plan.toggle(moment.video_id)}>
              <Check size={15} /> {watched ? "Watched" : "Mark as watched"}
            </button>
          )}
        </div>

        {summary && <p className="stage-summary">{summary}</p>}
        {!inPlaylist && moment.key_points.length > 0 && <p className="stage-summary">{moment.key_points[0]}</p>}

        {topics.length > 0 && (
          <div className="stage-topics">
            <div className="eyebrow">Taught in this video</div>
            <ul>
              {topics.map(({ name, m }) => {
                const active = m.start_s === moment.start_s && moment.start_s > 0;
                return (
                  <li key={`${name}-${m.start_s}`}>
                    <button className={`stage-topic ${active ? "is-active" : ""}`} onClick={() => onPlay(m)}>
                      <span className="stamp-time"><Play size={9} fill="currentColor" /> {fmt(m.start_s)}</span>
                      <span className="stage-topic-name">{name}</span>
                      {m.depth === "mentioned" && <span className="badge badge-clay">Mentioned</span>}
                    </button>
                    {active && m.key_points.length > 0 && (
                      <ul className="stage-points">{m.key_points.map((p) => <li key={p}>{p}</li>)}</ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {inPlaylist && topics.length === 0 && (
          <p className="stage-summary muted">This video doesn't teach any topic from your outline.</p>
        )}
      </div>
    </div>
  );
}
