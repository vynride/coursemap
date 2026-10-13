import { fmt, type Moment } from "./api";

export default function Player({ moment }: { moment: Moment | null }) {
  if (!moment) {
    return <div className="player empty">Click any timestamp to watch that part of the lecture.</div>;
  }
  return (
    <div className="player">
      <iframe
        key={`${moment.video_id}-${moment.start_s}`}
        src={`https://www.youtube.com/embed/${moment.video_id}?start=${moment.start_s}&autoplay=1`}
        title={moment.video_title}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      <p>
        <b>{moment.video_title}</b>
        {moment.position >= 0 && <> · at {fmt(moment.start_s)}</>}
      </p>
      <ul>
        {moment.key_points.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </div>
  );
}
