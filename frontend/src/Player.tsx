import { Check, Maximize2, Minimize2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmt, type Job, type Moment } from "./api";
import { videoTopics } from "./course";
import type { Plan } from "./usePlan";
import { ENDED, loadYouTubeApi, type YTPlayer } from "./youtube";

/**
 * The main stage. One YouTube player stays mounted; clicking a topic seeks it instead of reloading,
 * a chapter bar shows where each outline topic sits in the video, and finishing a video marks it watched.
 */
export default function Player({ job, moment, autoplay, plan, theatre, onTheatre, onPlay }: {
  job: Job; moment: Moment; autoplay: boolean; plan: Plan;
  theatre: boolean; onTheatre: () => void; onPlay: (m: Moment) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const shownRef = useRef<Moment>(moment);   // the moment the player was last pointed at
  const endedRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [time, setTime] = useState(moment.start_s);
  const [apiDuration, setApiDuration] = useState(0);

  const inPlaylist = moment.position >= 0;
  endedRef.current = () => { if (inPlaylist) plan.markWatched(moment.video_id); };

  // Create the player once. It gets a fresh child element so StrictMode's remount works.
  useEffect(() => {
    let cancelled = false;
    const giveUp = window.setTimeout(() => { if (!playerRef.current) setFallback(true); }, 6000);
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const el = document.createElement("div");
      hostRef.current.appendChild(el);
      const first = shownRef.current;
      playerRef.current = new YT.Player(el, {
        videoId: first.video_id,
        playerVars: { start: first.start_s, autoplay: autoplay ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => { if (e.data === ENDED) endedRef.current(); },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      playerRef.current?.destroy();
      playerRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Point the player at a new moment: seek within the same video, otherwise load the other one.
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || shownRef.current === moment) return;
    shownRef.current = moment;
    if (player.getVideoData().video_id === moment.video_id) {
      player.seekTo(moment.start_s, true);
      player.playVideo();
    } else {
      player.loadVideoById({ videoId: moment.video_id, startSeconds: moment.start_s });
    }
    setTime(moment.start_s);
  }, [moment, ready]);

  // Follow playback for the playhead and the current chapter.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setTime(player.getCurrentTime() || 0);
      setApiDuration(player.getDuration() || 0);
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const video = job.videos.find((v) => v.id === moment.video_id);
  const duration = video?.duration_s || apiDuration;
  const topics = videoTopics(job, moment.video_id);
  const current = [...topics].reverse().find((t) => t.moment.start_s <= time + 1);
  const summary = job.analyses.find((a) => a.video_id === moment.video_id)?.summary;
  const watched = plan.done.has(moment.video_id);
  const pct = (s: number) => (duration ? Math.min(100, (100 * s) / duration) : 0);

  return (
    <div className="stage">
      <div className="stage-video">
        {fallback ? (
          <iframe
            key={`${moment.video_id}-${moment.start_s}`}
            src={`https://www.youtube.com/embed/${moment.video_id}?start=${moment.start_s}&autoplay=${autoplay ? 1 : 0}&rel=0`}
            title={moment.video_title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div ref={hostRef} className="stage-host" />
        )}
      </div>

      {topics.length > 0 && duration > 0 && (
        <div className="chapters" aria-label="Chapters">
          <div className="chapter-track">
            {topics.map((t, i) => {
              const end = topics[i + 1]?.moment.start_s ?? duration;
              return (
                <button key={`${t.name}-${t.moment.start_s}`}
                  className={`chapter ${current === t ? "is-current" : ""}`}
                  style={{ left: `${pct(t.moment.start_s)}%`, width: `${Math.max(1.5, pct(end) - pct(t.moment.start_s))}%` }}
                  title={`${fmt(t.moment.start_s)} · ${t.name}`} onClick={() => onPlay(t.moment)} />
              );
            })}
            <div className="playhead" style={{ left: `${pct(time)}%` }} />
          </div>
        </div>
      )}

      <div className="stage-meta">
        <div className="stage-title">
          <div>
            <div className="stage-eyebrow">
              {inPlaylist ? `Video ${moment.position + 1} of ${job.videos.length}` : "Suggested video · not in your playlist"}
              {current && <> · <span className="now">Now: {current.name}</span></>}
            </div>
            <h1>{moment.video_title}</h1>
          </div>
          <div className="stage-actions">
            {inPlaylist && (
              <button className={`btn-ghost ${watched ? "is-on" : ""}`} onClick={() => plan.toggle(moment.video_id)}>
                <Check size={15} /> {watched ? "Watched" : "Mark as watched"}
              </button>
            )}
            <button className="btn-ghost icon" onClick={onTheatre} title={theatre ? "Default view" : "Theatre mode"}
              aria-label={theatre ? "Default view" : "Theatre mode"}>
              {theatre ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        {summary && <p className="stage-summary">{summary}</p>}
        {!inPlaylist && moment.key_points.length > 0 && <p className="stage-summary">{moment.key_points[0]}</p>}

        {topics.length > 0 && (
          <ul className="stage-topics">
            {topics.map((t) => {
              const isCurrent = current === t;
              return (
                <li key={`${t.name}-${t.moment.start_s}`}>
                  <button className={`stage-topic ${isCurrent ? "is-current" : ""}`} onClick={() => onPlay(t.moment)}>
                    <span className="stamp-time"><Play size={9} fill="currentColor" /> {fmt(t.moment.start_s)}</span>
                    <span className="stage-topic-name">{t.name}</span>
                    {t.moment.depth === "mentioned" && <span className="badge badge-dark">Mentioned</span>}
                  </button>
                  {isCurrent && t.moment.key_points.length > 0 && (
                    <ul className="stage-points">{t.moment.key_points.map((p) => <li key={p}>{p}</li>)}</ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {inPlaylist && topics.length === 0 && (
          <p className="stage-summary">This video doesn't teach any topic from your outline.</p>
        )}
      </div>
    </div>
  );
}
