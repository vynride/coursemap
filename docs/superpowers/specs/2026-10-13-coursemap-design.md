# CourseMap: design

Date: 2026-10-13. Event: GeeksforGeeks x Google Cloud Hack Sprint (about 6 hours of build time). Track: EdTech / Campus.

## Problem

Most students in Indian universities prepare from YouTube lecture playlists, not from their own college lectures. A playlist is made by a creator for a general audience; the exam is set from the student's university syllabus in the university's question pattern. Two questions are left for the student to answer alone:

1. Does this playlist cover my syllabus, and what does it miss?
2. Can I answer the questions my university will ask, in the format and marks it asks them?

Students find out at the exam. YouTube's own features (captions, auto-translate, chapters, the "Ask" button) work one video at a time and know nothing about a syllabus or an exam pattern.

## Product

Paste a YouTube playlist link, upload the syllabus PDF (or paste its text), pick the exam pattern. CourseMap:

1. Reads the syllabus into units and topics (Gemini, PDF input).
2. Watches every lecture in the playlist (Gemini video understanding on the YouTube URL directly) and records which syllabus topics each lecture teaches, how deeply, and at which timestamp.
3. Shows a **syllabus map**: every topic marked Taught / Mentioned / Missing, with buttons that jump the embedded player to the exact moment it is taught. Missing topics get suggested YouTube videos.
4. Writes **exam-style practice questions** per unit in the chosen pattern, each tied to the moment in the playlist where the answer is taught.
5. **Grades a typed answer** like an examiner (score out of the question's marks, missing points) and offers "rewatch where this is taught".

One-line pitch: *your YouTube playlist, mapped to your syllabus and your exam.*

## USP and competitor answers

- **YouTube (Ask, chapters, captions):** one video at a time; no syllabus, no coverage gaps, no exam pattern.
- **NotebookLM:** accepts YouTube links and makes quizzes, but the source is the spine, not the syllabus. It does not tell you what your syllabus has that your sources lack, and does not grade in your university's mark scheme. This is the closest competitor; say so if asked.
- **Coaching apps:** fixed content; the student has to leave the playlist they already trust.

The USP: **the syllabus is the spine.** Every output (coverage, gaps, questions, grading) is organised by the student's syllabus units and grounded in timestamps from the student's own playlist.

## Golden path (the only thing that must work)

Playlist URL + syllabus PDF + pattern → progress screen → syllabus map with working timestamp jumps → practice question → typed answer graded → rewatch jump.

## In scope

- Public playlists up to 12 videos (configurable). Single-video links are treated as a one-video playlist.
- Syllabus as PDF or pasted text.
- Exam pattern as free text with three presets.
- Results cached per (video, syllabus) and per syllabus input, so repeated runs are instant and a class shares one analysis.
- Deployed on Cloud Run with Firestore.

## Out of scope

Accounts and login, private or unlisted playlists, non-YouTube video, PDF export, mobile app, multi-language UI, teacher dashboards. Mention these as roadmap in the pitch, don't build them.

## Google Cloud usage (each does essential work)

| Service | Job |
|---|---|
| Gemini on Vertex AI | Reads the syllabus PDF; watches each YouTube lecture by URL; writes questions; grades answers. Structured JSON output throughout. |
| YouTube Data API v3 | Lists playlist videos, durations and privacy; finds videos for missing topics. |
| Cloud Run | Hosts the API and the built frontend in one container. |
| Firestore | Job state (survives restarts, readable from any instance) and the analysis cache. |
| Secret Manager | YouTube API key. |
| Cloud Build | Builds the container on `gcloud run deploy --source`. |

## Correctness rules

- Gemini may only cite syllabus topic IDs it was given; unknown IDs are dropped.
- Timestamps are parsed and checked against the video's real duration; invalid ones fall back to the start of the video.
- Questions cite moments by index into a list we built; Gemini cannot invent a timestamp.
- One lecture failing to analyse does not fail the job; it is listed as skipped.
- Private, deleted and live videos are skipped and listed.

## Demo script (90 seconds)

1. "Riya is in third semester and has her Operating Systems exam in ten days. Like most of her class she studies from this 12-lecture YouTube playlist. What she can't tell is whether it's enough for her exam."
2. Paste the playlist, upload the university syllabus PDF, choose the pattern, press Map it. (The demo playlist is pre-cached, so the progress screen finishes in seconds.)
3. Syllabus map: "This playlist properly teaches 71% of her syllabus. Disk scheduling in Unit 4 is missing entirely; here are two videos that cover it." Click a taught topic and the player jumps to the exact minute.
4. Practice: open a 7-mark question, type a weak answer, get 3/7 with the missing points, press "Rewatch where this is taught".
5. Close: "From 'I watched twelve hours of video' to 'I know what's missing and I've practised in my exam's format'."

The percentages above are placeholders; use the real numbers from the cached demo run.

## Likely judge questions

- **Doesn't YouTube already do this?** YouTube answers questions about one video. It doesn't know your syllabus, can't tell you what a playlist is missing, and doesn't set or grade exam questions.
- **What about NotebookLM?** Closest tool. It starts from your sources, we start from your syllabus. The gap list and the exam-pattern grading are what it doesn't do.
- **Can Gemini hallucinate timestamps?** It can try. Topic IDs are restricted to the syllabus list, timestamps are validated against the real duration, and questions can only cite moments we extracted.
- **Cost?** Lectures are read at low media resolution and a low frame rate (audio carries most of a lecture). Analyses are cached per video and syllabus, so a class of 60 using the same playlist pays once.
- **Copyright?** We don't download or rehost anything. Gemini reads public videos through Google's YouTube integration, and students watch through the official embedded player, so views still count for the creator.
- **Business model?** Free for students. Colleges and coaching institutes pay for a class view (which topics the class is weakest on). Creators could use the map to see what their playlist lacks for each university.

## Scoring map

- Innovation (25%): syllabus-as-spine; timestamp-grounded questions and grading.
- Implementation (30%): deployed, end-to-end, cached demo, tests on the logic that guards against model errors.
- Impact (25%): a student-scale problem; one analysis serves a whole class.
- Google tech (20%): Gemini video understanding on YouTube URLs, Vertex AI, YouTube Data API, Cloud Run, Firestore, Secret Manager.
