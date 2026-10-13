import type { Job, Moment } from "./api";

const dockerfile: Moment = {
  video_id: "aaaaaaaaaaa", video_title: "Writing your first Dockerfile", position: 2, start_s: 312, depth: "explained",
  key_points: ["FROM sets the base image", "Each RUN adds a layer", "Order instructions so the cache is reused"],
};
const containers: Moment = {
  video_id: "bbbbbbbbbbb", video_title: "Images vs containers", position: 0, start_s: 95, depth: "explained",
  key_points: ["An image is a read-only template", "A container is a running instance of an image"],
};
const volumes: Moment = {
  video_id: "aaaaaaaaaaa", video_title: "Writing your first Dockerfile", position: 2, start_s: 1180, depth: "mentioned",
  key_points: ["Data inside a container is lost when it is removed"],
};

export const fixtureJob: Job = {
  id: "fixture", playlist_id: "PLfixture", exam_pattern: "2-point short answers on concepts, then 5-point practical scenario questions.",
  status: "done", progress_done: 2, progress_total: 2, error: null,
  syllabus: {
    course: "Docker",
    units: [
      { id: "U1", title: "Docker basics", topics: [{ id: "U1.T1", name: "Images and containers" }, { id: "U1.T2", name: "Container networking" }] },
      { id: "U2", title: "Building images", topics: [{ id: "U2.T1", name: "Dockerfile" }, { id: "U2.T2", name: "Volumes" }] },
    ],
  },
  videos: [
    { id: "bbbbbbbbbbb", title: "Images vs containers", position: 0, duration_s: 2700 },
    { id: "eeeeeeeeeee", title: "Installing Docker", position: 1, duration_s: 1200 },
    { id: "aaaaaaaaaaa", title: "Writing your first Dockerfile", position: 2, duration_s: 3300 },
    { id: "fffffffffff", title: "Docker CLI cheatsheet", position: 3, duration_s: 2400 },
    { id: "ggggggggggg", title: "Multi-stage builds", position: 4, duration_s: 3000 },
    { id: "hhhhhhhhhhh", title: "Pushing to a registry", position: 5, duration_s: 1800 },
    { id: "iiiiiiiiiii", title: "Docker Compose crash course", position: 6, duration_s: 3600 },
    { id: "jjjjjjjjjjj", title: "Debugging containers", position: 7, duration_s: 2700 },
  ],
  analyses: [],
  skipped_videos: [{ video_id: "ccccccccccc", title: "Private video", reason: "private or deleted" }],
  coverage: [
    { topic_id: "U1.T1", unit_id: "U1", topic_name: "Images and containers", status: "covered", moments: [containers] },
    { topic_id: "U1.T2", unit_id: "U1", topic_name: "Container networking", status: "gap", moments: [] },
    { topic_id: "U2.T1", unit_id: "U2", topic_name: "Dockerfile", status: "covered", moments: [dockerfile] },
    { topic_id: "U2.T2", unit_id: "U2", topic_name: "Volumes", status: "partial", moments: [volumes] },
  ],
  suggestions: [{ topic_id: "U1.T2", video_id: "ddddddddddd", title: "Docker networking explained", channel: "Some Channel" }],
  questions: [
    { id: "U1.Q1", unit_id: "U1", marks: 2, text: "What is the difference between an image and a container?", answer_points: ["Image is a read-only template", "Container is a running instance"], moment: containers },
    { id: "U2.Q1", unit_id: "U2", marks: 5, text: "Your image rebuilds every dependency on each code change. How would you reorder the Dockerfile to fix it?", answer_points: ["Copy dependency files first", "Install dependencies", "Copy source code last", "Explain layer caching", "Rebuild only changes later layers"], moment: dockerfile },
    { id: "U1.Q2", unit_id: "U1", marks: 5, text: "Two containers need to talk to each other. How would you set that up?", answer_points: ["User-defined bridge network", "Containers reach each other by name", "docker network create / --network"], moment: null },
  ],
};
