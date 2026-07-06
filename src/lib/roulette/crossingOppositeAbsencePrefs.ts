import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import type { CrossingAxisKind } from "@/lib/roulette/liveTableColdStats";
import { maxCrossingOppositeAbsenceInWindowForTable } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import {
  CROSSING_ABSENCE_AUTO_OFFSET,
  CROSSING_ABSENCE_SPINS_MAX,
  CROSSING_ABSENCE_SPINS_MIN,
  DEFAULT_CROSSING_ABSENCE_SPINS,
  type CrossingAbsenceAxisKind,
  clampCrossingAbsenceSpins,
  crossingAxisKindToAbsenceKey,
} from "@/lib/roulette/crossingAbsencePrefs";
import {
  getRotatingRoomGatilhoEnabled,
  setRotatingRoomGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";

export {
  CROSSING_ABSENCE_SPINS_MIN,
  CROSSING_ABSENCE_SPINS_MAX,
  DEFAULT_CROSSING_ABSENCE_SPINS,
  crossingAxisKindToAbsenceKey,
  type CrossingAbsenceAxisKind,
};

export type CrossingOppositeAxisAbsenceSpins = {
  corAltura: number;
  alturaParidade: number;
};

export type CrossingOppositeAxisAbsenceAuto = {
  corAltura: boolean;
  alturaParidade: boolean;
};

export type CrossingOppositeTableAbsenceSpins = CrossingOppositeAxisAbsenceSpins;

export type CrossingOppositeAbsenceByTable = Record<number, CrossingOppositeTableAbsenceSpins>;

const LOCAL_KEY_COR_ALTURA = "roulette.rotatingRoom.crossingOppositeAbsenceSpins.corAltura";
const LOCAL_KEY_ALTURA_PARIDADE = "roulette.rotatingRoom.crossingOppositeAbsenceSpins.alturaParidade";
const LOCAL_KEY_COR_ALTURA_AUTO = "roulette.rotatingRoom.crossingOppositeAbsenceAuto.corAltura";
const LOCAL_KEY_ALTURA_PARIDADE_AUTO = "roulette.rotatingRoom.crossingOppositeAbsenceAuto.alturaParidade";

export const CROSSING_OPPOSITE_ABSENCE_SPINS_CHANGED_EVENT = "crossing-opposite-absence-spins-changed";

let serverEffectiveOppositeAbsenceByAxis: CrossingOppositeAxisAbsenceSpins | null = null;
let serverOppositeAbsenceByTable: CrossingOppositeAbsenceByTable | null = null;
let serverOppositeAbsenceAuto: CrossingOppositeAxisAbsenceAuto | null = null;

export function absenceSpinsForCrossingOppositeAxis(
  kind: CrossingAbsenceAxisKind,
  map: CrossingOppositeAxisAbsenceSpins,
): number {
  return map[kind];
}

export function crossingOppositeAutoAbsenceSpinsFromMax(maxInWindow: number): number {
  return clampCrossingAbsenceSpins(maxInWindow - CROSSING_ABSENCE_AUTO_OFFSET);
}

export function normalizeCrossingOppositeAxisAbsenceAuto(raw?: {
  crossingCorAlturaOppositeAbsenceAuto?: boolean;
  crossingAlturaParidadeOppositeAbsenceAuto?: boolean;
} | null): CrossingOppositeAxisAbsenceAuto {
  return {
    corAltura: raw?.crossingCorAlturaOppositeAbsenceAuto === true,
    alturaParidade: raw?.crossingAlturaParidadeOppositeAbsenceAuto === true,
  };
}

export function normalizeCrossingOppositeAxisAbsenceSpins(raw?: {
  crossingCorAlturaOppositeAbsenceSpins?: number;
  crossingAlturaParidadeOppositeAbsenceSpins?: number;
} | null): CrossingOppositeAxisAbsenceSpins {
  const legacy = DEFAULT_CROSSING_ABSENCE_SPINS;
  return {
    corAltura: clampCrossingAbsenceSpins(raw?.crossingCorAlturaOppositeAbsenceSpins, legacy),
    alturaParidade: clampCrossingAbsenceSpins(raw?.crossingAlturaParidadeOppositeAbsenceSpins, legacy),
  };
}

export function setServerCrossingOppositeAxisAbsenceSpins(
  spins: CrossingOppositeAxisAbsenceSpins | null,
): void {
  serverEffectiveOppositeAbsenceByAxis =
    spins == null
      ? null
      : {
          corAltura: clampCrossingAbsenceSpins(spins.corAltura),
          alturaParidade: clampCrossingAbsenceSpins(spins.alturaParidade),
        };
}

export function setServerCrossingOppositeAbsenceByTable(
  byTable: CrossingOppositeAbsenceByTable | null,
): void {
  if (byTable == null) {
    serverOppositeAbsenceByTable = null;
    return;
  }
  const next: CrossingOppositeAbsenceByTable = {};
  for (const [tableIdRaw, spins] of Object.entries(byTable)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId)) continue;
    next[tableId] = {
      corAltura: clampCrossingAbsenceSpins(spins.corAltura),
      alturaParidade: clampCrossingAbsenceSpins(spins.alturaParidade),
    };
  }
  serverOppositeAbsenceByTable = next;
}

export function setServerCrossingOppositeAxisAbsenceAuto(
  auto: CrossingOppositeAxisAbsenceAuto | null,
): void {
  serverOppositeAbsenceAuto =
    auto == null ? null : { corAltura: auto.corAltura === true, alturaParidade: auto.alturaParidade === true };
}

function readCrossingOppositeAxisAbsenceAutoLocal(): CrossingOppositeAxisAbsenceAuto {
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

export function writeCrossingOppositeAxisAbsenceAutoLocal(
  auto: CrossingOppositeAxisAbsenceAuto,
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
    window.dispatchEvent(new CustomEvent(CROSSING_OPPOSITE_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

function readCrossingOppositeAxisAbsenceSpinsLocal(): CrossingOppositeAxisAbsenceSpins {
  if (typeof localStorage === "undefined") {
    return { corAltura: DEFAULT_CROSSING_ABSENCE_SPINS, alturaParidade: DEFAULT_CROSSING_ABSENCE_SPINS };
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
    return { corAltura: DEFAULT_CROSSING_ABSENCE_SPINS, alturaParidade: DEFAULT_CROSSING_ABSENCE_SPINS };
  }
}

export function writeCrossingOppositeAxisAbsenceSpinsLocal(
  spins: CrossingOppositeAxisAbsenceSpins,
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
    window.dispatchEvent(new CustomEvent(CROSSING_OPPOSITE_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

export function readEffectiveCrossingOppositeAxisAbsenceSpins(): CrossingOppositeAxisAbsenceSpins {
  if (serverEffectiveOppositeAbsenceByAxis != null) return { ...serverEffectiveOppositeAbsenceByAxis };
  return readCrossingOppositeAxisAbsenceSpinsLocal();
}

export function readEffectiveCrossingOppositeAxisAbsenceAuto(): CrossingOppositeAxisAbsenceAuto {
  if (serverOppositeAbsenceAuto != null) return { ...serverOppositeAbsenceAuto };
  return readCrossingOppositeAxisAbsenceAutoLocal();
}

/** Giros de ausência oposta para uma mesa — no automático, calcula a partir do histórico da mesa. */
export function readOppositeAbsenceSpinsForTable(
  tableId: number,
  kind: CrossingAbsenceAxisKind,
  historyNewestFirst?: readonly number[],
): number {
  const auto = readEffectiveCrossingOppositeAxisAbsenceAuto();
  const global = readEffectiveCrossingOppositeAxisAbsenceSpins();
  if (!auto[kind]) return global[kind];

  const history = historyNewestFirst;
  if (history?.length) {
    const maxInWindow = maxCrossingOppositeAbsenceInWindowForTable(history, kind);
    if (maxInWindow > 0) return crossingOppositeAutoAbsenceSpinsFromMax(maxInWindow);
  }

  const perTable = serverOppositeAbsenceByTable?.[tableId];
  if (perTable) return perTable[kind];

  return global[kind];
}

export function syncCrossingOppositeAbsencePrefsFromAutomationConfig(
  opposite: Pick<
    AutomationStatsDto["crossingOppositeAbsence"],
    "corAltura" | "alturaParidade"
  >,
): void {
  writeCrossingOppositeAxisAbsenceSpinsLocal(
    {
      corAltura: opposite.corAltura.absenceSpins,
      alturaParidade: opposite.alturaParidade.absenceSpins,
    },
    { silent: true },
  );
  writeCrossingOppositeAxisAbsenceAutoLocal(
    {
      corAltura: opposite.corAltura.absenceAuto === true,
      alturaParidade: opposite.alturaParidade.absenceAuto === true,
    },
    { silent: true },
  );
  setRotatingRoomGatilhoEnabled({
    ...getRotatingRoomGatilhoEnabled(),
    crossingCorAlturaOpposite: opposite.corAltura.enabled,
    crossingAlturaParidadeOpposite: opposite.alturaParidade.enabled,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CROSSING_OPPOSITE_ABSENCE_SPINS_CHANGED_EVENT));
  }
}
