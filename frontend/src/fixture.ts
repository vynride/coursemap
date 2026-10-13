import type { Job, Moment } from "./api";

const bankers: Moment = {
  video_id: "aaaaaaaaaaa", video_title: "L6 Deadlocks", position: 5, start_s: 872, depth: "explained",
  key_points: ["Safe state and safe sequence", "Need = Max - Allocation"],
};
const states: Moment = {
  video_id: "bbbbbbbbbbb", video_title: "L1 Processes", position: 0, start_s: 95, depth: "explained",
  key_points: ["New, ready, running, waiting, terminated"],
};
const recovery: Moment = {
  video_id: "aaaaaaaaaaa", video_title: "L6 Deadlocks", position: 5, start_s: 1500, depth: "mentioned",
  key_points: ["Kill a process"],
};

export const fixtureJob: Job = {
  id: "fixture", playlist_id: "PLfixture", exam_pattern: "Part A: 2-mark short answers. Part B: 7-mark long answers.",
  status: "done", progress_done: 2, progress_total: 2, error: null,
  syllabus: {
    course: "Operating Systems",
    units: [
      { id: "U1", title: "Processes", topics: [{ id: "U1.T1", name: "Process states" }, { id: "U1.T2", name: "Context switching" }] },
      { id: "U2", title: "Deadlocks", topics: [{ id: "U2.T1", name: "Banker's algorithm" }, { id: "U2.T2", name: "Deadlock recovery" }] },
    ],
  },
  videos: [
    { id: "bbbbbbbbbbb", title: "L1 Processes", position: 0, duration_s: 1500 },
    { id: "aaaaaaaaaaa", title: "L6 Deadlocks", position: 5, duration_s: 2400 },
  ],
  analyses: [],
  skipped_videos: [{ video_id: "ccccccccccc", title: "Private video", reason: "private or deleted" }],
  coverage: [
    { topic_id: "U1.T1", unit_id: "U1", topic_name: "Process states", status: "covered", moments: [states] },
    { topic_id: "U1.T2", unit_id: "U1", topic_name: "Context switching", status: "gap", moments: [] },
    { topic_id: "U2.T1", unit_id: "U2", topic_name: "Banker's algorithm", status: "covered", moments: [bankers] },
    { topic_id: "U2.T2", unit_id: "U2", topic_name: "Deadlock recovery", status: "partial", moments: [recovery] },
  ],
  suggestions: [{ topic_id: "U1.T2", video_id: "ddddddddddd", title: "Context switching explained", channel: "Some Channel" }],
  questions: [
    { id: "U1.Q1", unit_id: "U1", marks: 2, text: "List the states of a process.", answer_points: ["New, ready, running, waiting, terminated"], moment: states },
    { id: "U2.Q1", unit_id: "U2", marks: 7, text: "Explain the Banker's algorithm with an example.", answer_points: ["Safe state", "Need = Max - Allocation", "Safety algorithm steps", "Worked example"], moment: bankers },
    { id: "U1.Q2", unit_id: "U1", marks: 7, text: "Explain context switching.", answer_points: ["Save PCB", "Load next PCB", "Overhead"], moment: null },
  ],
};
