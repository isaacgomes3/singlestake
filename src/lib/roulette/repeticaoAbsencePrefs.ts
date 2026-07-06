import type { FibonacciZoneKind } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import {
  getRotatingRoomGatilhoEnabled,
  setRotatingRoomGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";
import {
  clampFibonacciAbsenceSpins,
  DEFAULT_FIBONACCI_ABSENCE_SPINS,
  fibonacciAutoAbsenceSpinsFromMax,
  type FibonacciZoneAbsenceAuto,
  normalizeFibonacciZoneAbsenceAuto,
} from "@/lib/roulette/fibonacciAbsencePrefs";

export type RepeticaoZoneAbsenceSpins = {
  dozen: number;
  column: number;
};

const LOCAL_KEY_DOZEN = "roulette.rotatingRoom.repeticaoAbsenceSpins.dozen";
const LOCAL_KEY_COLUMN = "roulette.rotatingRoom.repeticaoAbsenceSpins.column";
const LOCAL_KEY_DOZEN_AUTO = "roulette.rotatingRoom.repeticaoAbsenceAuto.dozen";
const LOCAL_KEY_COLUMN_AUTO = "roulette.rotatingRoom.repeticaoAbsenceAuto.column";
const REPETICAO_GATILHO_LOCAL_KEY = "roulette.rotatingRoom.repeticaoGatilhoEnabled";

export const REPETICAO_ABSENCE_SPINS_CHANGED_EVENT = "repeticao-absence-spins-changed";

let serverEffectiveAbsenceByZone: RepeticaoZoneAbsenceSpins | null = null;

export function uniformRepeticaoAbsenceSpins(spins: number): RepeticaoZoneAbsenceSpins {
  const clamped = clampFibonacciAbsenceSpins(spins);
  return { dozen: clamped, column: clamped };
}

export function normalizeRepeticaoZoneAbsenceSpins(raw?: {
  repeticaoAbsenceSpins?: number;
  repeticaoDozenAbsenceSpins?: number;
  repeticaoColumnAbsenceSpins?: number;
} | null): RepeticaoZoneAbsenceSpins {
  const legacy = clampFibonacciAbsenceSpins(raw?.repeticaoAbsenceSpins);
  return {
    dozen: clampFibonacciAbsenceSpins(raw?.repeticaoDozenAbsenceSpins, legacy),
    column: clampFibonacciAbsenceSpins(raw?.repeticaoColumnAbsenceSpins, legacy),
  };
}

export function normalizeRepeticaoZoneAbsenceAuto(raw?: {
  repeticaoDozenAbsenceAuto?: boolean;
  repeticaoColumnAbsenceAuto?: boolean;
} | null): FibonacciZoneAbsenceAuto {
  return {
    dozen: raw?.repeticaoDozenAbsenceAuto === true,
    column: raw?.repeticaoColumnAbsenceAuto === true,
  };
}

export function setServerRepeticaoZoneAbsenceSpins(spins: RepeticaoZoneAbsenceSpins | null): void {
  serverEffectiveAbsenceByZone =
    spins == null
      ? null
      : {
          dozen: clampFibonacciAbsenceSpins(spins.dozen),
          column: clampFibonacciAbsenceSpins(spins.column),
        };
}

function readRepeticaoZoneAbsenceSpinsLocal(): RepeticaoZoneAbsenceSpins {
  if (typeof localStorage === "undefined") {
    return uniformRepeticaoAbsenceSpins(DEFAULT_FIBONACCI_ABSENCE_SPINS);
  }
  try {
    const dozenRaw = localStorage.getItem(LOCAL_KEY_DOZEN);
    const columnRaw = localStorage.getItem(LOCAL_KEY_COLUMN);
    const fallback = DEFAULT_FIBONACCI_ABSENCE_SPINS;
    return {
      dozen: dozenRaw != null ? clampFibonacciAbsenceSpins(parseInt(dozenRaw, 10)) : fallback,
      column: columnRaw != null ? clampFibonacciAbsenceSpins(parseInt(columnRaw, 10)) : fallback,
    };
  } catch {
    return uniformRepeticaoAbsenceSpins(DEFAULT_FIBONACCI_ABSENCE_SPINS);
  }
}

export function writeRepeticaoZoneAbsenceAutoLocal(
  auto: FibonacciZoneAbsenceAuto,
  options?: { silent?: boolean },
): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCAL_KEY_DOZEN_AUTO, auto.dozen ? "1" : "0");
      localStorage.setItem(LOCAL_KEY_COLUMN_AUTO, auto.column ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPETICAO_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

export function writeRepeticaoZoneAbsenceSpinsLocal(
  spins: RepeticaoZoneAbsenceSpins,
  options?: { silent?: boolean },
): void {
  const clamped = {
    dozen: clampFibonacciAbsenceSpins(spins.dozen),
    column: clampFibonacciAbsenceSpins(spins.column),
  };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCAL_KEY_DOZEN, String(clamped.dozen));
      localStorage.setItem(LOCAL_KEY_COLUMN, String(clamped.column));
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPETICAO_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

export function readEffectiveRepeticaoZoneAbsenceSpins(): RepeticaoZoneAbsenceSpins {
  if (serverEffectiveAbsenceByZone != null) return { ...serverEffectiveAbsenceByZone };
  return readRepeticaoZoneAbsenceSpinsLocal();
}

export function absenceSpinsForRepeticaoKind(
  kind: FibonacciZoneKind,
  map: RepeticaoZoneAbsenceSpins,
): number {
  return map[kind];
}

export function syncRepeticaoPrefsFromAutomationConfig(
  repeticao: Pick<AutomationStatsDto["repeticao"], "enabled" | "dozen" | "column">,
): void {
  writeRepeticaoZoneAbsenceSpinsLocal(
    {
      dozen: repeticao.dozen.absenceSpins,
      column: repeticao.column.absenceSpins,
    },
    { silent: true },
  );
  writeRepeticaoZoneAbsenceAutoLocal(
    {
      dozen: repeticao.dozen.absenceAuto === true,
      column: repeticao.column.absenceAuto === true,
    },
    { silent: true },
  );
  const masterOn = repeticao.dozen.enabled || repeticao.column.enabled;
  setRotatingRoomGatilhoEnabled({
    ...getRotatingRoomGatilhoEnabled(),
    repeticao: masterOn,
    repeticaoDozen: repeticao.dozen.enabled,
    repeticaoColumn: repeticao.column.enabled,
  });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(REPETICAO_GATILHO_LOCAL_KEY, masterOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPETICAO_ABSENCE_SPINS_CHANGED_EVENT));
  }
}
