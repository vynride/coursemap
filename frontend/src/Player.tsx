import { CirclePlay } from "lucide-react";
import { fmt, type Moment } from "./api";

export default function Player({ moment }: { moment: Moment | null }) {
  if (!moment) {
    return (
      <div className="card player-empty">
        <div className="icon"><CirclePlay size={22} strokeWidth={1.8} /></div>
        <b>Watch the exact moment</b>
        <span>Click any timestamp to play that part of the video here.</span>
      </div>
    );
  }
  return (
    <div className="card player">
      <iframe
        key={`${moment.video_id}-${moment.start_s}`}
        src={`https://www.youtube.com/embed/${moment.video_id}?start=${moment.start_s}&autoplay=1`}
        title={moment.video_title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      <div className="player-body">
        <div className="eyebrow">
          {moment.position >= 0 ? `Video ${moment.position + 1} · from ${fmt(moment.start_s)}` : "Suggested video"}
        </div>
        <h4>{moment.video_title}</h4>
        {moment.key_points.length > 0 && (
          <ul>{moment.key_points.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
      </div>
    </div>
  );
}
