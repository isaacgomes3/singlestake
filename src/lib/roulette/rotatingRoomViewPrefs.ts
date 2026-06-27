export type RotatingRoomPanelOffset = { x: number; y: number };

const STAT_SIZE_KEY = "roulette.rotatingRoom.statSize.v1";
const STATS_VISIBLE_KEY = "roulette.rotatingRoom.statsVisible.v1";

export type RotatingRoomStatCounterSize = "sm" | "md" | "lg";

export function readRotatingRoomStatCounterSize(): RotatingRoomStatCounterSize {
  if (typeof localStorage === "undefined") return "md";
  try {
    const raw = localStorage.getItem(STAT_SIZE_KEY);
    if (raw === "sm" || raw === "md" || raw === "lg") return raw;
    return "md";
  } catch {
    return "md";
  }
}

export function writeRotatingRoomStatCounterSize(size: RotatingRoomStatCounterSize): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STAT_SIZE_KEY, size);
}

export function readRotatingRoomStatsVisible(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(STATS_VISIBLE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeRotatingRoomStatsVisible(visible: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STATS_VISIBLE_KEY, visible ? "1" : "0");
}

const IFRAME_MODE_KEY = "roulette.rotatingRoom.iframeMode.v1";
const PANEL_OFFSET_KEY = "roulette.rotatingRoom.panelOffset.v1";
const SIGNAL_ONLY_MODE_KEY = "roulette.rotatingRoom.signalOnlyMode.v1";

/** `null` = automático (só sinal em ecrãs estreitos). */
export function readRotatingRoomSignalOnlyMode(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SIGNAL_ONLY_MODE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeRotatingRoomSignalOnlyMode(enabled: boolean | null): void {
  if (typeof localStorage === "undefined") return;
  if (enabled === null) localStorage.removeItem(SIGNAL_ONLY_MODE_KEY);
  else localStorage.setItem(SIGNAL_ONLY_MODE_KEY, enabled ? "1" : "0");
  dispatchRotatingRoomViewPrefsChange();
}

export const ROTATING_ROOM_VIEW_PREFS_EVENT = "rotating-room-view-prefs";

function dispatchRotatingRoomViewPrefsChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_VIEW_PREFS_EVENT));
}

export function readRotatingRoomIframeMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(IFRAME_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRotatingRoomIframeMode(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(IFRAME_MODE_KEY, enabled ? "1" : "0");
  dispatchRotatingRoomViewPrefsChange();
}

/** Activa iframe embutido com painel flutuante sobre o casino. */
export function prepareRotatingRoomIframeSession(): void {
  writeRotatingRoomIframeMode(true);
  writeRotatingRoomSignalOnlyMode(false);
}

function parsePanelOffset(): RotatingRoomPanelOffset {
  if (typeof localStorage === "undefined") return { x: 0, y: 0 };
  try {
    const raw = localStorage.getItem(PANEL_OFFSET_KEY);
    if (!raw) return { x: 0, y: 0 };
    const o = JSON.parse(raw) as { x?: unknown; y?: unknown };
    const x = Number(o.x);
    const y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    return { x, y };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function readRotatingRoomPanelOffset(): RotatingRoomPanelOffset {
  return parsePanelOffset();
}

export function writeRotatingRoomPanelOffset(pos: RotatingRoomPanelOffset): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_OFFSET_KEY, JSON.stringify(pos));
}

export function clearRotatingRoomPanelOffset(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PANEL_OFFSET_KEY);
}

export function clampRotatingRoomPanelOffset(
  pos: RotatingRoomPanelOffset,
  vw: number,
  vh: number,
): RotatingRoomPanelOffset {
  const maxX = Math.max(80, vw * 0.38);
  const maxY = Math.max(80, vh * 0.38);
  return {
    x: Math.min(maxX, Math.max(-maxX, pos.x)),
    y: Math.min(maxY, Math.max(-maxY, pos.y)),
  };
}
