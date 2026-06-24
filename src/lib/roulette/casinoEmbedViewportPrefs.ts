export type CasinoEmbedViewportInsets = {
  topPct: number;
  bottomPct: number;
  leftPct: number;
  rightPct: number;
};

/** Recorte por defeito — página do operador (breadcrumbs + barra inferior). */
export const DEFAULT_CASINO_EMBED_VIEWPORT: CasinoEmbedViewportInsets = {
  topPct: 11,
  bottomPct: 8.5,
  leftPct: 0,
  rightPct: 0,
};

const STORAGE_KEY = "roulette.casinoEmbedViewport.v1";
const MAX_INSET_PCT = 35;

export const CASINO_EMBED_VIEWPORT_CHANGED_EVENT = "roulette-casino-embed-viewport-changed";

function clampInset(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_INSET_PCT, Math.max(0, n));
}

export function clampCasinoEmbedViewport(v: CasinoEmbedViewportInsets): CasinoEmbedViewportInsets {
  return {
    topPct: clampInset(v.topPct),
    bottomPct: clampInset(v.bottomPct),
    leftPct: clampInset(v.leftPct),
    rightPct: clampInset(v.rightPct),
  };
}

function insetsFromEnv(): Partial<CasinoEmbedViewportInsets> {
  const top = Number(import.meta.env.VITE_CASINO_EMBED_CROP_TOP);
  const bottom = Number(import.meta.env.VITE_CASINO_EMBED_CROP_BOTTOM);
  const left = Number(import.meta.env.VITE_CASINO_EMBED_CROP_LEFT);
  const right = Number(import.meta.env.VITE_CASINO_EMBED_CROP_RIGHT);
  const out: Partial<CasinoEmbedViewportInsets> = {};
  if (Number.isFinite(top) && top >= 0) out.topPct = top;
  if (Number.isFinite(bottom) && bottom >= 0) out.bottomPct = bottom;
  if (Number.isFinite(left) && left >= 0) out.leftPct = left;
  if (Number.isFinite(right) && right >= 0) out.rightPct = right;
  return out;
}

export function readCasinoEmbedViewport(): CasinoEmbedViewportInsets | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<CasinoEmbedViewportInsets>;
    return clampCasinoEmbedViewport({
      topPct: Number(o.topPct),
      bottomPct: Number(o.bottomPct),
      leftPct: Number(o.leftPct ?? 0),
      rightPct: Number(o.rightPct ?? 0),
    });
  } catch {
    return null;
  }
}

export function writeCasinoEmbedViewport(v: CasinoEmbedViewportInsets): void {
  if (typeof localStorage === "undefined") return;
  const clamped = clampCasinoEmbedViewport(v);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
  window.dispatchEvent(
    new CustomEvent(CASINO_EMBED_VIEWPORT_CHANGED_EVENT, { detail: clamped }),
  );
}

/** `true` se o utilizador já guardou uma moldura personalizada. */
export function hasSavedCasinoEmbedViewport(): boolean {
  return readCasinoEmbedViewport() != null;
}

export function clearCasinoEmbedViewport(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(CASINO_EMBED_VIEWPORT_CHANGED_EVENT, {
      detail: resolveCasinoEmbedViewport(),
    }),
  );
}

export function resolveCasinoEmbedViewport(
  override?: Partial<CasinoEmbedViewportInsets>,
): CasinoEmbedViewportInsets {
  const stored = readCasinoEmbedViewport();
  const base = stored ?? {
    ...DEFAULT_CASINO_EMBED_VIEWPORT,
    ...insetsFromEnv(),
  };
  return clampCasinoEmbedViewport({ ...base, ...(override ?? {}) });
}
