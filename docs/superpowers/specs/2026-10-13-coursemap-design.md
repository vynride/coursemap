# CourseMap: design

Date: 2026-10-13. Event: GeeksforGeeks x Google Cloud Hack Sprint (about 6 hours of build time). Team: v3as. Track: EdTech.

## Problem

Students learn most industry skills (Docker, DSA, system design, web frameworks) outside class, from YouTube playlists. A college course comes with a syllabus, a course plan, tests, graded answers and deadlines. A YouTube playlist comes with none of them, so the learner is left to answer alone:

1. Does this playlist cover what I need to learn, and what does it skip?
2. How do I pace it, and how do I know I actually understood it?

YouTube's own features (captions, chapters, the "Ask" button) work one video at a time and know nothing about what the learner is trying to learn.

## Product

Paste a YouTube playlist link and what you want to learn: a list of topics, a skill roadmap, a job description, or a syllabus PDF. Pick a test style. CourseMap turns the playlist into a course:

1. **Reads the outline** into units and topics (Gemini; text or PDF input). Outlines without units are grouped into units in learning order.
2. **Watches every video** (Gemini video understanding on the YouTube URL directly) and records which outline topics each video teaches, how deeply (explained or only mentioned), from which timestamp, and the key points the instructor makes.
3. **Course map:** every topic marked Taught / Mentioned / Missing, with timestamps that seek the player to the exact moment. Missing topics get suggested YouTube videos.
4. **Study plan:** pick a start date and hours per week; the playlist is split into weekly sessions with due dates. Unit tests and gap videos sit in the week they belong to. Shows "On track" or "N weeks behind"; a video is marked watched when it ends or by hand. Progress is kept in the browser.
5. **Study notes per session:** for each week, each video's summary and the topics it teaches with timestamps and key points, plus that week's gap videos and tests. Copyable as Markdown with youtu.be links at the right second.
6. **Practice:** questions per unit in the chosen test style, each tied to the moment where the answer is taught. Typed answers are graded (score, what was missed) with "rewatch where this is taught".
7. **Missing videos replaced:** private, deleted, non-public, live or unwatchable videos are skipped, the rest carries on, and a search finds up to two replacement videos on the same subject. They appear in the playlist where the missing video was.

One-line pitch: *your YouTube playlist, run like a college course.*

## Interface

Dark theme modelled on YouTube's watch page:

- Centre: the player (YouTube IFrame API, one player that seeks instead of reloading), a chapter bar with one segment per outline topic and a live playhead, the video title, "Mark as watched", a theatre-mode toggle, the summary and the topics taught in this video (the current one expands to its key points). Below: Course map / Study notes / Practice tabs.
- Right: course progress (percent complete, on-track status, taught / mentioned / missing counts, plan settings) over the playlist grouped by week, with checkboxes, gap videos, unit tests, session notes and missing-video replacements.
- Playing a video from the playlist starts it where its first outline topic starts, skipping the intro.
- The progress screen steps through each stage (outline, playlist, videos with a count, questions) even when cached results finish instantly.

## USP and competitor answers

- **YouTube (Ask, chapters, captions):** one video at a time; no outline, no gaps across a playlist, no plan, no tests.
- **NotebookLM:** accepts YouTube links and makes quizzes, but the sources are the spine. It does not tell you what your outline needs that your sources lack, does not plan your weeks, and does not point you to the second where an answer is taught. Closest competitor; say so if asked.
- **Paid course platforms:** structured, but the learner has to leave the free playlist they already chose and trust.

The USP: **your outline is the spine, your playlist is the content.** Coverage, gaps, plan, notes, questions and grading are organised by the learner's outline and grounded in timestamps from their own playlist.

## Golden path (the only thing that must work)

Playlist URL + outline + test style → progress screen → course page: player seeks to a topic, course map with gaps and suggestions, weekly plan, session notes → practice question → typed answer graded → rewatch jump.

## In scope

- Public playlists up to 20 videos (`MAX_VIDEOS`, configurable). Single-video links are treated as a one-video playlist.
- Outline as pasted text or PDF.
- Test style as free text with three presets: Concepts + scenarios, Interview style, Quick quiz.
- Results cached per (model, video, outline) and per outline input, so repeated runs are instant and a class shares one analysis.
- Deployed on Cloud Run with Firestore.
- Offline demo mode (`DEMO=1`): a recorded run on a real playlist, no Google calls, for rehearsal and as a fallback without network.

## Out of scope

Accounts and progress sync across devices, ready-made job-role outlines, private or unlisted playlists, non-YouTube video, regional-language UI, mobile app, teacher dashboards. Roadmap items for the pitch, not built.

## Google Cloud usage (each does essential work)

| Service | Job |
|---|---|
| Gemini on Vertex AI | Reads the outline (text or PDF); watches each YouTube video by URL; writes questions; grades answers. Structured JSON output throughout. |
| YouTube Data API v3 | Lists playlist videos, durations and privacy; finds videos for missing topics and replacements for missing videos. |
| YouTube IFrame Player API | The embedded player: seeking, playback position for the chapter bar, end-of-video detection. |
| Cloud Run | Hosts the API and the built frontend in one container. |
| Firestore | Job state (survives restarts, readable from any instance) and the analysis cache. |
| Secret Manager | YouTube API key. |
| Cloud Build / Artifact Registry | Build and store the container on `gcloud run deploy --source`. |

## Correctness rules

- Gemini may only cite outline topic IDs it was given; unknown IDs are dropped.
- Timestamps are parsed and checked against the video's real duration; invalid ones fall back to the start of the video.
- Questions cite moments by index into a list we built; Gemini cannot invent a timestamp.
- One video failing to analyse does not fail the job; it is skipped and gets replacement suggestions.
- Replacement suggestions never include a video already in the playlist.
- The learner's answer is passed to the grader between markers and treated only as an answer, never as instructions.

## Demo script (90 seconds)

1. "Riya is in third year and wants to learn Docker before placement season. She found an 18-video Docker playlist in Hindi. What she can't tell is whether it covers what a developer needs, and how to fit it around college."
2. Paste the playlist and the Docker outline, pick "Concepts + scenarios", build. (The demo playlist is pre-cached, so the progress screen steps through in a few seconds.)
3. Course page: "It teaches 76% of the outline properly. Layer caching, multi-stage builds, networking and security aren't in it at all; here are videos that cover them." Click a topic and the player jumps to the second it starts.
4. Right panel: "Three hours a week from today: six weeks, with a test after each unit." Open Session 2 notes.
5. Practice: answer a question badly, get 1/2 with the missing point, press "Rewatch where this is taught".
6. Close: "From a playlist she hoped was enough to a course she can finish."

Numbers come from the demo run on Code Step By Step's "Docker tutorial in Hindi" (18 videos) against a 21-topic Docker outline: 16 taught, 1 mentioned, 4 missing, 17 questions. Re-check them against the live Gemini run.

## Likely judge questions

- **Doesn't YouTube already do this?** YouTube answers questions about one video. It doesn't know what you're trying to learn, can't tell you what a playlist is missing, and doesn't plan, take notes for or test you.
- **What about NotebookLM?** Closest tool. It starts from your sources, we start from your outline. The gap list, the weekly plan and the timestamp-grounded grading are what it doesn't do.
- **Can Gemini hallucinate timestamps?** It can try. Topic IDs are restricted to the outline, timestamps are validated against the real duration, and questions can only cite moments we extracted.
- **What if a video is removed?** It's skipped, the rest of the course still works, and a replacement on the same subject is suggested in its place.
- **Cost?** Videos are read at low media resolution and a low frame rate (audio carries most of a lesson). Analyses are cached per video and outline, so a class using the same playlist pays once.
- **Copyright?** We don't download or rehost anything. Gemini reads public videos through Google's YouTube integration, and learners watch through the official embedded player, so views still count for the creator.
- **Business model?** Free for students. Colleges and placement cells pay for curated skill tracks and a class view of weak topics. Creators can see what their playlist lacks.

## Scoring map

- Innovation (25%): outline as the spine; a playlist turned into a planned, noted, tested course; timestamp-grounded questions and grading.
- Implementation (30%): deployed end to end, cached demo, offline fallback, tests on the logic that guards against model errors.
- Impact (25%): self-taught industry skills are a student-scale problem; one analysis serves a whole class.
- Google tech (20%): Gemini video understanding on YouTube URLs via Vertex AI, YouTube Data and IFrame APIs, Cloud Run, Firestore, Secret Manager, Cloud Build.
