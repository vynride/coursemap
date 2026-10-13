import type { Job, Moment, Suggestion, Video } from "./api";

export interface VideoTopic { name: string; moment: Moment }

/** Outline topics a video teaches, in the order they come up. */
export function videoTopics(job: Job, videoId: string): VideoTopic[] {
  return job.coverage
    .flatMap((c) => c.moments.filter((m) => m.video_id === videoId).map((moment) => ({ name: c.topic_name, moment })))
    .sort((a, b) => a.moment.start_s - b.moment.start_s);
}

/** Play a playlist video from where its first outline topic starts, skipping the intro. */
export function videoMoment(job: Job, video: Video): Moment {
  const first = videoTopics(job, video.id)[0];
  return {
    video_id: video.id, video_title: video.title, position: video.position,
    start_s: first?.moment.start_s ?? 0, depth: "explained", key_points: [],
  };
}

export function suggestionMoment(s: Suggestion): Moment {
  return {
    video_id: s.video_id, video_title: s.title, position: -1, start_s: 0, depth: "explained",
    key_points: [`From ${s.channel}. Not part of your playlist.`],
  };
}
