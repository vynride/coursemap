import type { Job, Suggestion, Unit, Video } from "./api";

export interface Week {
  index: number;            // 1-based
  due: Date;                // end of the week
  videos: Video[];
  seconds: number;          // watch time this week
  tests: Unit[];            // units whose last video lands in this week
  gaps: Suggestion[];       // suggested videos for gaps in those units
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Which units each video teaches, from the coverage map. */
function unitsByVideo(job: Job): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const entry of job.coverage) {
    for (const m of entry.moments) {
      if (!map.has(m.video_id)) map.set(m.video_id, new Set());
      map.get(m.video_id)!.add(entry.unit_id);
    }
  }
  return map;
}

/**
 * Split the playlist into weeks of at most `hoursPerWeek` watch time, in playlist order.
 * A video longer than a week's budget gets a week to itself. A unit's test is due in the
 * week its last teaching video is watched; units no video teaches are tested in the last week.
 */
export function buildPlan(job: Job, start: Date, hoursPerWeek: number): Week[] {
  const budget = Math.max(0.5, hoursPerWeek) * 3600;
  const videos = [...job.videos].sort((a, b) => a.position - b.position);
  const weeks: Week[] = [];
  let current: Week | null = null;
  for (const video of videos) {
    if (!current || (current.videos.length > 0 && current.seconds + video.duration_s > budget)) {
      current = { index: weeks.length + 1, due: new Date(start.getTime() + (weeks.length + 1) * 7 * DAY_MS - DAY_MS),
        videos: [], seconds: 0, tests: [], gaps: [] };
      weeks.push(current);
    }
    current.videos.push(video);
    current.seconds += video.duration_s;
  }
  if (weeks.length === 0) return weeks;

  const teaches = unitsByVideo(job);
  const lastWeek = new Map<string, Week>();
  for (const week of weeks) {
    for (const video of week.videos) {
      for (const unitId of teaches.get(video.id) ?? []) lastWeek.set(unitId, week);
    }
  }
  const unitOfTopic = new Map(job.coverage.map((c) => [c.topic_id, c.unit_id]));
  for (const unit of job.syllabus?.units ?? []) {
    const week = lastWeek.get(unit.id) ?? weeks[weeks.length - 1];
    week.tests.push(unit);
    week.gaps.push(...job.suggestions.filter((s) => unitOfTopic.get(s.topic_id) === unit.id));
  }
  return weeks;
}

export function hours(seconds: number): string {
  const h = seconds / 3600;
  return h < 1 ? `${Math.round(seconds / 60)} min` : `${h.toFixed(1)} h`;
}
