export const LIVE_SSE_STATUS_EVENT = "roulette-live-sse-status";

export type LiveSseStatusDetail = {
  status: "idle" | "connecting" | "open" | "error";
  message: string | null;
};

export function dispatchLiveSseStatus(detail: LiveSseStatusDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LIVE_SSE_STATUS_EVENT, { detail }));
}
