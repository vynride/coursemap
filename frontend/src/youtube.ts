// Minimal typing for the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference).
export interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  loadVideoById(args: { videoId: string; startSeconds: number }): void;
  cueVideoById(args: { videoId: string; startSeconds: number }): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string };
  destroy(): void;
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string;
    playerVars: Record<string, number>;
    events: { onReady: () => void; onStateChange: (e: { data: number }) => void };
  }) => YTPlayer;
}

declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

export const ENDED = 0;

let loading: Promise<YTNamespace> | null = null;

/** Load the IFrame API script once and resolve with window.YT. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!loading) {
    loading = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return loading;
}
