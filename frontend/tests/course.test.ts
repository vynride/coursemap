// Run: node --test frontend/tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Job, Moment } from "../src/api.ts";
import { videoMoment, videoTopics } from "../src/course.ts";

const m = (start_s: number): Moment => ({
  video_id: "v1", video_title: "V1", position: 0, start_s, depth: "explained", key_points: [],
});

const job = {
  videos: [{ id: "v1", title: "V1", position: 0, duration_s: 600 }, { id: "v2", title: "V2", position: 1, duration_s: 300 }],
  coverage: [
    { topic_id: "U1.T2", unit_id: "U1", topic_name: "Later topic", status: "covered", moments: [m(300)] },
    { topic_id: "U1.T1", unit_id: "U1", topic_name: "First topic", status: "covered", moments: [m(95)] },
  ],
} as unknown as Job;

test("topics in a video come in the order they are taught", () => {
  assert.deepEqual(videoTopics(job, "v1").map((t) => t.name), ["First topic", "Later topic"]);
});

test("a playlist video starts where its first topic starts, skipping the intro", () => {
  assert.equal(videoMoment(job, job.videos[0]).start_s, 95);
});

test("a video that teaches nothing from the outline starts at 0", () => {
  assert.equal(videoMoment(job, job.videos[1]).start_s, 0);
});
