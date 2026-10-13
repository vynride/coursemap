// Run: node --test frontend/tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Job } from "../src/api.ts";
import { buildPlan } from "../src/plan.ts";

const moment = (video_id: string) => ({
  video_id, video_title: video_id, position: 0, start_s: 0, depth: "explained" as const, key_points: [],
});

function job(): Job {
  return {
    id: "j", playlist_id: "PL", exam_pattern: "", status: "done", progress_done: 0, progress_total: 0, error: null,
    syllabus: {
      course: "Docker",
      units: [
        { id: "U1", title: "Basics", topics: [{ id: "U1.T1", name: "Images" }, { id: "U1.T2", name: "Networking" }] },
        { id: "U2", title: "Builds", topics: [{ id: "U2.T1", name: "Dockerfile" }] },
        { id: "U3", title: "Untaught", topics: [{ id: "U3.T1", name: "Swarm" }] },
      ],
    },
    // Out of order on purpose: the plan must follow playlist position.
    videos: [
      { id: "c", title: "C", position: 2, duration_s: 3600 },
      { id: "a", title: "A", position: 0, duration_s: 3600 },
      { id: "b", title: "B", position: 1, duration_s: 3600 },
      { id: "d", title: "D", position: 3, duration_s: 4 * 3600 },
    ],
    analyses: [], skipped_videos: [],
    coverage: [
      { topic_id: "U1.T1", unit_id: "U1", topic_name: "Images", status: "covered", moments: [moment("a")] },
      { topic_id: "U1.T2", unit_id: "U1", topic_name: "Networking", status: "gap", moments: [] },
      { topic_id: "U2.T1", unit_id: "U2", topic_name: "Dockerfile", status: "covered", moments: [moment("c")] },
      { topic_id: "U3.T1", unit_id: "U3", topic_name: "Swarm", status: "gap", moments: [] },
    ],
    suggestions: [{ topic_id: "U1.T2", video_id: "s1", title: "Networking explained", channel: "X" }],
    questions: [],
  };
}

const start = new Date("2026-10-13T00:00:00");

test("splits videos into weeks by hours, in playlist order", () => {
  const weeks = buildPlan(job(), start, 2);
  assert.deepEqual(weeks.map((w) => w.videos.map((v) => v.id)), [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual(weeks.map((w) => w.seconds), [7200, 3600, 4 * 3600]);
});

test("a video longer than the weekly budget gets its own week", () => {
  const weeks = buildPlan(job(), start, 1);
  assert.deepEqual(weeks.map((w) => w.videos.map((v) => v.id)), [["a"], ["b"], ["c"], ["d"]]);
});

test("each week is due six days after it starts", () => {
  const weeks = buildPlan(job(), start, 2);
  assert.deepEqual(weeks.map((w) => w.due.toDateString()),
    [new Date("2026-10-19T00:00:00"), new Date("2026-10-26T00:00:00"), new Date("2026-11-02T00:00:00")].map((d) => d.toDateString()));
});

test("unit tests land in the week of the unit's last teaching video; untaught units go last", () => {
  const weeks = buildPlan(job(), start, 2);
  assert.deepEqual(weeks.map((w) => w.tests.map((u) => u.id)), [["U1"], ["U2"], ["U3"]]);
});

test("gap suggestions go with their unit's test", () => {
  const weeks = buildPlan(job(), start, 2);
  assert.deepEqual(weeks.map((w) => w.gaps.map((s) => s.video_id)), [["s1"], [], []]);
});

test("no videos means no weeks", () => {
  assert.deepEqual(buildPlan({ ...job(), videos: [] }, start, 3), []);
});
