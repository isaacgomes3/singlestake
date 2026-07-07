import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import type { CrossingAxisKind } from "@/lib/roulette/liveTableColdStats";
import {
  maxCrossingAbsenceForAutoTriggerReference,
} from "@/lib/roulette/crossingAbsenceFilterStats";
import {
  getRotatingRoomGatilhoEnabled,
  setRotatingRoomGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";

export const CROSSING_ABSENCE_SPINS_MIN = 3;
export const CROSSING_ABSENCE_SPINS_MAX = 99;
export const DEFAULT_CROSSING_ABSENCE_SPINS = 12;
/** Desvio do gatilho automático em relação à máx. ausência na janela (0 = gatilho igual à máx.). */
export const CROSSING_ABSENCE_AUTO_TRIGGER_BONUS = 0;

/** Janela de análise para ausência de cruzamento (giros por mesa). */
export const CROSSING_ABSENCE_STATS_SPIN_WINDOW = 50;

export type CrossingAbsenceAxisKind = "corAltura" | "alturaParidade";

export type CrossingAxisAbsenceSpins = {
  corAltura: number;
  alturaParidade: number;
};

export type CrossingAxisAbsenceAuto = {
  corAltura: boolean;
  alturaParidade: boolean;
};

export type CrossingTableAbsenceSpins = CrossingAxisAbsenceSpins;

export type CrossingAbsenceByTable = Record<number, CrossingTableAbsenceSpins>;

const LOCAL_KEY_COR_ALTURA = "roulette.rotatingRoom.crossingAbsenceSpins.corAltura";
const LOCAL_KEY_ALTURA_PARIDADE = "roulette.rotatingRoom.crossingAbsenceSpins.alturaParidade";
const LOCAL_KEY_COR_ALTURA_AUTO = "roulette.rotatingRoom.crossingAbsenceAuto.corAltura";
const LOCAL_KEY_ALTURA_PARIDADE_AUTO = "roulette.rotatingRoom.crossingAbsenceAuto.alturaParidade";

export const CROSSING_ABSENCE_SPINS_CHANGED_EVENT = "crossing-absence-spins-changed";

let serverEffectiveAbsenceByAxis: CrossingAxisAbsenceSpins | null = null;
let serverCrossingAbsenceByTable: CrossingAbsenceByTable | null = null;
let serverCrossingAbsenceAuto: CrossingAxisAbsenceAuto | null = null;

export function crossingAxisKindToAbsenceKey(axis: CrossingAxisKind): CrossingAbsenceAxisKind | null {
  if (axis === "cor-altura") return "corAltura";
  if (axis === "altura-paridade") return "alturaParidade";
  return null;
}

export function absenceKeyToCrossingAxis(kind: CrossingAbsenceAxisKind): CrossingAxisKind {
  return kind === "corAltura" ? "cor-altura" : "altura-paridade";
}

export function clampCrossingAbsenceSpins(
  value: unknown,
  fallback = DEFAULT_CROSSING_ABSENCE_SPINS,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    CROSSING_ABSENCE_SPINS_MAX,
    Math.max(CROSSING_ABSENCE_SPINS_MIN, Math.floor(n)),
  );
}

export function uniformCrossingAxisAbsenceSpins(spins: number): CrossingAxisAbsenceSpins {
  const clamped = clampCrossingAbsenceSpins(spins);
  return { corAltura: clamped, alturaParidade: clamped };
}

export function absenceSpinsForCrossingAxis(
  kind: CrossingAbsenceAxisKind,
  map: CrossingAxisAbsenceSpins,
): number {
  return map[kind];
}

export function crossingAutoAbsenceSpinsFromMax(maxInWindow: number): number {
  return clampCrossingAbsenceSpins(maxInWindow + CROSSING_ABSENCE_AUTO_TRIGGER_BONUS);
}

export function normalizeCrossingAxisAbsenceAuto(raw?: {
  crossingCorAlturaAbsenceAuto?: boolean;
  crossingAlturaParidadeAbsenceAuto?: boolean;
} | null): CrossingAxisAbsenceAuto {
  return {
    corAltura: raw?.crossingCorAlturaAbsenceAuto === true,
    alturaParidade: raw?.crossingAlturaParidadeAbsenceAuto === true,
  };
}

export function normalizeCrossingAxisAbsenceSpins(raw?: {
  crossingCorAlturaAbsenceSpins?: number;
  crossingAlturaParidadeAbsenceSpins?: number;
} | null): CrossingAxisAbsenceSpins {
  const legacy = DEFAULT_CROSSING_ABSENCE_SPINS;
  return {
    corAltura: clampCrossingAbsenceSpins(raw?.crossingCorAlturaAbsenceSpins, legacy),
    alturaParidade: clampCrossingAbsenceSpins(raw?.crossingAlturaParidadeAbsenceSpins, legacy),
  };
}

export function setServerCrossingAxisAbsenceSpins(spins: CrossingAxisAbsenceSpins | null): void {
  serverEffectiveAbsenceByAxis =
    spins == null
      ? null
      : {
          corAltura: clampCrossingAbsenceSpins(spins.corAltura),
          alturaParidade: clampCrossingAbsenceSpins(spins.alturaParidade),
        };
}

export function setServerCrossingAbsenceByTable(byTable: CrossingAbsenceByTable | null): void {
  if (byTable == null) {
    serverCrossingAbsenceByTable = null;
    return;
  }
  const next: CrossingAbsenceByTable = {};
  for (const [tableIdRaw, spins] of Object.entries(byTable)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId)) continue;
    next[tableId] = {
      corAltura: clampCrossingAbsenceSpins(spins.corAltura),
      alturaParidade: clampCrossingAbsenceSpins(spins.alturaParidade),
    };
  }
  serverCrossingAbsenceByTable = next;
}

export function setServerCrossingAxisAbsenceAuto(auto: CrossingAxisAbsenceAuto | null): void {
  serverCrossingAbsenceAuto =
    auto == null ? null : { corAltura: auto.corAltura === true, alturaParidade: auto.alturaParidade === true };
}

function readCrossingAxisAbsenceAutoLocal(): CrossingAxisAbsenceAuto {
  if (typeof localStorage === "undefined") {
    return { corAltura: false, alturaParidade: false };
  }
  try {
    return {
      corAltura: localStorage.getItem(LOCAL_KEY_COR_ALTURA_AUTO) === "1",
      alturaParidade: localStorage.getItem(LOCAL_KEY_ALTURA_PARIDADE_AUTO) === "1",
    };
  } catch {
    return { corAltura: false, alturaParidade: false };
  }
}

export function writeCrossingAxisAbsenceAutoLocal(
  auto: CrossingAxisAbsenceAuto,
  options?: { silent?: boolean },
): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCAL_KEY_COR_ALTURA_AUTO, auto.corAltura ? "1" : "0");
      localStorage.setItem(LOCAL_KEY_ALTURA_PARIDADE_AUTO, auto.alturaParidade ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CROSSING_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

function readCrossingAxisAbsenceSpinsLocal(): CrossingAxisAbsenceSpins {
  if (typeof localStorage === "undefined") {
    return uniformCrossingAxisAbsenceSpins(DEFAULT_CROSSING_ABSENCE_SPINS);
  }
  try {
    const corRaw = localStorage.getItem(LOCAL_KEY_COR_ALTURA);
    const altRaw = localStorage.getItem(LOCAL_KEY_ALTURA_PARIDADE);
    const legacy = DEFAULT_CROSSING_ABSENCE_SPINS;
    return {
      corAltura: corRaw != null ? clampCrossingAbsenceSpins(parseInt(corRaw, 10)) : legacy,
      alturaParidade: altRaw != null ? clampCrossingAbsenceSpins(parseInt(altRaw, 10)) : legacy,
    };
  } catch {
    return uniformCrossingAxisAbsenceSpins(DEFAULT_CROSSING_ABSENCE_SPINS);
  }
}

export function writeCrossingAxisAbsenceSpinsLocal(
  spins: CrossingAxisAbsenceSpins,
  options?: { silent?: boolean },
): void {
  const clamped = {
    corAltura: clampCrossingAbsenceSpins(spins.corAltura),
    alturaParidade: clampCrossingAbsenceSpins(spins.alturaParidade),
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCAL_KEY_COR_ALTURA, String(clamped.corAltura));
      localStorage.setItem(LOCAL_KEY_ALTURA_PARIDADE, String(clamped.alturaParidade));
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CROSSING_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

export function readEffectiveCrossingAxisAbsenceSpins(): CrossingAxisAbsenceSpins {
  if (serverEffectiveAbsenceByAxis != null) return { ...serverEffectiveAbsenceByAxis };
  return readCrossingAxisAbsenceSpinsLocal();
}

export function readEffectiveCrossingAxisAbsenceAuto(): CrossingAxisAbsenceAuto {
  if (serverCrossingAbsenceAuto != null) return { ...serverCrossingAbsenceAuto };
  return readCrossingAxisAbsenceAutoLocal();
}

/** Giros de ausência de cruzamento para uma mesa — no automático, calcula a partir do histórico da mesa. */
export function readCrossingAbsenceSpinsForTable(
  tableId: number,
  kind: CrossingAbsenceAxisKind,
  historyNewestFirst?: readonly number[],
): number {
  const auto = readEffectiveCrossingAxisAbsenceAuto();
  const global = readEffectiveCrossingAxisAbsenceSpins();
  if (!auto[kind]) return global[kind];

  const history = historyNewestFirst;
  if (history?.length) {
    const referenceMax = maxCrossingAbsenceForAutoTriggerReference(history, kind);
    if (referenceMax > 0) return crossingAutoAbsenceSpinsFromMax(referenceMax);
  }

  const perTable = serverCrossingAbsenceByTable?.[tableId];
  if (perTable) return perTable[kind];

  return global[kind];
}

export function syncCrossingAbsencePrefsFromAutomationConfig(
  crossing: Pick<
    AutomationStatsDto["crossingAbsence"],
    "corAltura" | "alturaParidade"
  >,
): void {
  writeCrossingAxisAbsenceSpinsLocal(
    {
      corAltura: crossing.corAltura.absenceSpins,
      alturaParidade: crossing.alturaParidade.absenceSpins,
    },
    { silent: true },
  );
  writeCrossingAxisAbsenceAutoLocal(
    {
      corAltura: crossing.corAltura.absenceAuto === true,
      alturaParidade: crossing.alturaParidade.absenceAuto === true,
    },
    { silent: true },
  );
  setRotatingRoomGatilhoEnabled({
    ...getRotatingRoomGatilhoEnabled(),
    crossingCorAltura: crossing.corAltura.enabled,
    crossingAlturaParidade: crossing.alturaParidade.enabled,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CROSSING_ABSENCE_SPINS_CHANGED_EVENT));
  }
}
