const STORAGE_KEY = "roulette.casinoMesaTapeteOffset";

export type TapetePanelOffset = { x: number; y: number };

function parseStored(): Record<string, TapetePanelOffset> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, TapetePanelOffset> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v == null || typeof v !== "object") continue;
      const p = v as Record<string, unknown>;
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out[k] = { x, y };
    }
    return out;
  } catch {
    return {};
  }
}

export function readTapetePanelOffset(tableId: number): TapetePanelOffset {
  const row = parseStored()[String(tableId)];
  return row ?? { x: 0, y: 0 };
}

export function writeTapetePanelOffset(tableId: number, pos: TapetePanelOffset): void {
  if (typeof localStorage === "undefined") return;
  const all = parseStored();
  all[String(tableId)] = { x: pos.x, y: pos.y };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearTapetePanelOffset(tableId: number): void {
  if (typeof localStorage === "undefined") return;
  const all = parseStored();
  delete all[String(tableId)];
  if (Object.keys(all).length === 0) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** Limita deslocamento para o painel não sair por completo do ecrã. */
export function clampTapeteOffset(
  pos: TapetePanelOffset,
  vw: number,
  vh: number,
): TapetePanelOffset {
  const maxX = Math.max(120, vw * 0.42);
  const maxYUp = Math.max(120, vh * 0.55);
  const maxYDown = 80;
  return {
    x: Math.min(maxX, Math.max(-maxX, pos.x)),
    y: Math.min(maxYDown, Math.max(-maxYUp, pos.y)),
  };
}
