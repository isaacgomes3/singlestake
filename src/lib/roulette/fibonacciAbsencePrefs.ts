import type { FibonacciZoneKind } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import {
  getRotatingRoomGatilhoEnabled,
  setRotatingRoomGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";

const FIBONACCI_GATILHO_LOCAL_KEY = "roulette.rotatingRoom.fibonacciGatilhoEnabled";

export const FIBONACCI_ABSENCE_SPINS_MIN = 3;
export const FIBONACCI_ABSENCE_SPINS_MAX = 99;
/** Alinhado com ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS — não importar da strategy (ciclo de módulos). */
export const DEFAULT_FIBONACCI_ABSENCE_SPINS = 12;

export type FibonacciZoneAbsenceSpins = {
  dozen: number;
  column: number;
};

const LOCAL_KEY_DOZEN = "roulette.rotatingRoom.fibonacciAbsenceSpins.dozen";
const LOCAL_KEY_COLUMN = "roulette.rotatingRoom.fibonacciAbsenceSpins.column";
/** @deprecated Migração — valor único antigo. */
const LOCAL_KEY_LEGACY = "roulette.rotatingRoom.fibonacciAbsenceSpins";

export const FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT = "fibonacci-absence-spins-changed";

let serverEffectiveAbsenceByZone: FibonacciZoneAbsenceSpins | null = null;

export function clampFibonacciAbsenceSpins(
  value: unknown,
  fallback = DEFAULT_FIBONACCI_ABSENCE_SPINS,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(
    FIBONACCI_ABSENCE_SPINS_MAX,
    Math.max(FIBONACCI_ABSENCE_SPINS_MIN, Math.floor(n)),
  );
}

export function uniformFibonacciAbsenceSpins(spins: number): FibonacciZoneAbsenceSpins {
  const clamped = clampFibonacciAbsenceSpins(spins);
  return { dozen: clamped, column: clamped };
}

export function absenceSpinsForZoneKind(
  kind: FibonacciZoneKind,
  map: FibonacciZoneAbsenceSpins,
): number {
  return map[kind];
}

export function normalizeFibonacciZoneAbsenceSpins(raw?: {
  fibonacciAbsenceSpins?: number;
  fibonacciDozenAbsenceSpins?: number;
  fibonacciColumnAbsenceSpins?: number;
} | null): FibonacciZoneAbsenceSpins {
  const legacy = clampFibonacciAbsenceSpins(raw?.fibonacciAbsenceSpins);
  return {
    dozen: clampFibonacciAbsenceSpins(raw?.fibonacciDozenAbsenceSpins, legacy),
    column: clampFibonacciAbsenceSpins(raw?.fibonacciColumnAbsenceSpins, legacy),
  };
}

export function setServerFibonacciZoneAbsenceSpins(spins: FibonacciZoneAbsenceSpins | null): void {
  serverEffectiveAbsenceByZone =
    spins == null
      ? null
      : {
          dozen: clampFibonacciAbsenceSpins(spins.dozen),
          column: clampFibonacciAbsenceSpins(spins.column),
        };
}

/** @deprecated Use setServerFibonacciZoneAbsenceSpins */
export function setServerFibonacciAbsenceSpins(spins: number | null): void {
  setServerFibonacciZoneAbsenceSpins(spins == null ? null : uniformFibonacciAbsenceSpins(spins));
}

function readFibonacciZoneAbsenceSpinsLocal(): FibonacciZoneAbsenceSpins {
  if (typeof localStorage === "undefined") {
    return uniformFibonacciAbsenceSpins(DEFAULT_FIBONACCI_ABSENCE_SPINS);
  }
  try {
    const legacyRaw = localStorage.getItem(LOCAL_KEY_LEGACY);
    const legacy =
      legacyRaw != null
        ? clampFibonacciAbsenceSpins(parseInt(legacyRaw, 10))
        : DEFAULT_FIBONACCI_ABSENCE_SPINS;
    const dozenRaw = localStorage.getItem(LOCAL_KEY_DOZEN);
    const columnRaw = localStorage.getItem(LOCAL_KEY_COLUMN);
    return {
      dozen: dozenRaw != null ? clampFibonacciAbsenceSpins(parseInt(dozenRaw, 10)) : legacy,
      column: columnRaw != null ? clampFibonacciAbsenceSpins(parseInt(columnRaw, 10)) : legacy,
    };
  } catch {
    return uniformFibonacciAbsenceSpins(DEFAULT_FIBONACCI_ABSENCE_SPINS);
  }
}

export function writeFibonacciZoneAbsenceSpinsLocal(
  spins: FibonacciZoneAbsenceSpins,
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
      localStorage.removeItem(LOCAL_KEY_LEGACY);
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

/** @deprecated Use writeFibonacciZoneAbsenceSpinsLocal */
export function writeFibonacciAbsenceSpinsLocal(
  spins: number,
  options?: { silent?: boolean },
): void {
  writeFibonacciZoneAbsenceSpinsLocal(uniformFibonacciAbsenceSpins(spins), options);
}

/** Giros de ausência por tipo (servidor, localStorage ou defeito 12). */
export function readEffectiveFibonacciZoneAbsenceSpins(): FibonacciZoneAbsenceSpins {
  if (serverEffectiveAbsenceByZone != null) return { ...serverEffectiveAbsenceByZone };
  return readFibonacciZoneAbsenceSpinsLocal();
}

/** Valor único legado — máximo entre dúzia e coluna (textos genéricos). */
export function readEffectiveFibonacciAbsenceSpins(): number {
  const map = readEffectiveFibonacciZoneAbsenceSpins();
  return Math.max(map.dozen, map.column);
}

/** Alinha preferências locais com a configuração global (painel admin). */
export function syncFibonacciPrefsFromAutomationConfig(
  fibonacci: Pick<AutomationStatsDto["fibonacci"], "enabled" | "dozen" | "column">,
): void {
  writeFibonacciZoneAbsenceSpinsLocal(
    {
      dozen: fibonacci.dozen.absenceSpins,
      column: fibonacci.column.absenceSpins,
    },
    { silent: true },
  );
  const masterOn = fibonacci.dozen.enabled || fibonacci.column.enabled;
  setRotatingRoomGatilhoEnabled({
    ...getRotatingRoomGatilhoEnabled(),
    fibonacci: masterOn,
    fibonacciDozen: fibonacci.dozen.enabled,
    fibonacciColumn: fibonacci.column.enabled,
  });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FIBONACCI_GATILHO_LOCAL_KEY, masterOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT));
  }
}
