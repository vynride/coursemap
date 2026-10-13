import { useEffect, useMemo, useState } from "react";
import type { Job } from "./api";
import { buildPlan, type Week } from "./plan";

export interface PlanSettings { start: string; hoursPerWeek: number; done: string[] }

export interface Plan {
  settings: PlanSettings;
  setSettings: (s: PlanSettings) => void;
  weeks: Week[];
  done: Set<string>;
  toggle: (videoId: string) => void;
  markWatched: (videoId: string) => void;
  behind: number;   // past-due weeks with unwatched videos
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function load(jobId: string): PlanSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(`coursemap:plan:${jobId}`) ?? "null");
    if (saved && typeof saved.start === "string") return saved;
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return { start: today(), hoursPerWeek: 3, done: [] };
}

export function usePlan(job: Job): Plan {
  const [settings, setSettings] = useState<PlanSettings>(() => load(job.id));
  useEffect(() => {
    try {
      localStorage.setItem(`coursemap:plan:${job.id}`, JSON.stringify(settings));
    } catch {
      // progress just won't survive a reload
    }
  }, [job.id, settings]);

  const weeks = useMemo(
    () => buildPlan(job, new Date(`${settings.start}T00:00:00`), settings.hoursPerWeek),
    [job, settings.start, settings.hoursPerWeek],
  );
  const done = useMemo(() => new Set(settings.done), [settings.done]);
  const now = new Date();
  const behind = weeks.filter((w) => w.due < now && w.videos.some((v) => !done.has(v.id))).length;

  function toggle(videoId: string) {
    setSettings((s) => ({
      ...s, done: s.done.includes(videoId) ? s.done.filter((x) => x !== videoId) : [...s.done, videoId],
    }));
  }

  function markWatched(videoId: string) {
    setSettings((s) => (s.done.includes(videoId) ? s : { ...s, done: [...s.done, videoId] }));
  }

  return { settings, setSettings, weeks, done, toggle, markWatched, behind };
}
