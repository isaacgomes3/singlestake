/** Histórico local do 24D Spin (SSE Pragmatic DGA). Mais recente = índice 0. */

export const DGA_24D_SPIN_HISTORY_STORAGE_KEY = "pragmatic.24dSpin.history.v1";
export const DGA_24D_SPIN_HISTORY_CHANGED_EVENT = "pragmatic:24d-spin-history-changed";

const MAX_LEN = 40;

export type Dga24dSpinStored = {
  number: number;
  color: "red" | "black" | null;
  gameId: string;
};

function readLastGameId(): string | null {
  try {
    return sessionStorage.getItem("pragmatic.24dSpin.lastGameId.v1");
  } catch {
    return null;
  }
}

function writeLastGameId(id: string | null) {
  try {
    if (id === null) sessionStorage.removeItem("pragmatic.24dSpin.lastGameId.v1");
    else sessionStorage.setItem("pragmatic.24dSpin.lastGameId.v1", id);
  } catch {
    /* */
  }
}

export function readDga24dSpinHistory(): Dga24dSpinStored[] {
  try {
    const raw = sessionStorage.getItem(DGA_24D_SPIN_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Dga24dSpinStored[] = [];
    for (const x of parsed) {
      if (x == null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const n = Number(o.number);
      const gameId = o.gameId != null ? String(o.gameId) : "";
      if (!Number.isInteger(n) || n < 1 || n > 24 || !gameId) continue;
      const col = o.color;
      const color =
        col === "red" || col === "black" ? col : null;
      out.push({ number: n, color, gameId });
    }
    return out;
  } catch {
    return [];
  }
}

function persistHistory(spins: Dga24dSpinStored[]) {
  try {
    sessionStorage.setItem(DGA_24D_SPIN_HISTORY_STORAGE_KEY, JSON.stringify(spins));
  } catch {
    /* */
  }
}

export function dispatchDga24dSpinHistoryChanged() {
  try {
    window.dispatchEvent(new CustomEvent(DGA_24D_SPIN_HISTORY_CHANGED_EVENT));
  } catch {
    /* */
  }
}

function normalizeColor(raw: unknown): "red" | "black" | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  if (c === "red") return "red";
  if (c === "black") return "black";
  return null;
}

/** Substitui o histórico local pelo lote do servidor (`last20Results`, mais recente primeiro). */
export function replaceDga24dSpinHistoryFromBatch(
  spins: { number?: number; color?: string | null; gameId?: string }[],
): void {
  if (typeof window === "undefined" || spins.length === 0) return;
  const mapped: Dga24dSpinStored[] = [];
  for (const s of spins) {
    const n = Number(s.number);
    const gameId = s.gameId != null ? String(s.gameId) : "";
    if (!Number.isInteger(n) || n < 1 || n > 24 || !gameId) continue;
    mapped.push({ number: n, color: normalizeColor(s.color), gameId });
  }
  if (mapped.length === 0) return;
  persistHistory(mapped.slice(0, MAX_LEN));
  const newest = mapped[0];
  if (newest) writeLastGameId(newest.gameId);
  dispatchDga24dSpinHistoryChanged();
}

export function appendDga24dSpinFromSse(spin: {
  number: number;
  color?: string | null;
  gameId: string;
}): "appended" | "ignored" {
  if (typeof window === "undefined") return "ignored";
  const n = Number(spin.number);
  if (!Number.isInteger(n) || n < 1 || n > 24) return "ignored";
  const gameId = String(spin.gameId ?? "");
  if (!gameId) return "ignored";

  const last = readLastGameId();
  if (last === gameId) return "ignored";
  writeLastGameId(gameId);

  const cur = readDga24dSpinHistory();
  const next = [
    { number: n, color: normalizeColor(spin.color), gameId },
    ...cur.filter((s) => s.gameId !== gameId),
  ].slice(0, MAX_LEN);
  persistHistory(next);
  dispatchDga24dSpinHistoryChanged();
  return "appended";
}
