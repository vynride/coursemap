export type JobStatus =
  | "queued" | "reading_syllabus" | "fetching_playlist" | "watching_videos"
  | "writing_questions" | "done" | "failed";
export interface Topic { id: string; name: string }
export interface Unit { id: string; title: string; topics: Topic[] }
export interface Syllabus { course: string; units: Unit[] }
export interface Video { id: string; title: string; position: number; duration_s: number }
export interface SkippedVideo { video_id: string; title: string; reason: string }
export interface Moment {
  video_id: string; video_title: string; position: number; start_s: number;
  depth: "explained" | "mentioned"; key_points: string[];
}
export interface CoverageEntry {
  topic_id: string; unit_id: string; topic_name: string;
  status: "covered" | "partial" | "gap"; moments: Moment[];
}
export interface Suggestion { topic_id: string; video_id: string; title: string; channel: string }
export interface Question {
  id: string; unit_id: string; marks: number; text: string; answer_points: string[]; moment: Moment | null;
}
export interface Grade {
  score: number; max_score: number; feedback: string; missing_points: string[]; rewatch: Moment | null;
}
export interface Job {
  id: string; playlist_id: string; exam_pattern: string; status: JobStatus;
  progress_done: number; progress_total: number; error: string | null;
  syllabus: Syllabus | null; videos: Video[]; analyses: { video_id: string; summary: string }[];
  skipped_videos: SkippedVideo[]; coverage: CoverageEntry[]; suggestions: Suggestion[]; questions: Question[];
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function createJob(form: FormData): Promise<{ job_id: string }> {
  return fetch("/api/jobs", { method: "POST", body: form }).then((r) => json(r));
}

export function getJob(id: string): Promise<Job> {
  return fetch(`/api/jobs/${id}`).then((r) => json(r));
}

export function gradeAnswer(jobId: string, questionId: string, answer: string): Promise<Grade> {
  return fetch(`/api/jobs/${jobId}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId, answer }),
  }).then((r) => json(r));
}

export function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
