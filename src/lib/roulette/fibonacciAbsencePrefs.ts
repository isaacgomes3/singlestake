import { ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export const FIBONACCI_ABSENCE_SPINS_MIN = 3;
export const FIBONACCI_ABSENCE_SPINS_MAX = 99;
export const DEFAULT_FIBONACCI_ABSENCE_SPINS = ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS;

const LOCAL_KEY = "roulette.rotatingRoom.fibonacciAbsenceSpins";

export const FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT = "fibonacci-absence-spins-changed";

let serverEffectiveAbsenceSpins: number | null = null;

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

export function setServerFibonacciAbsenceSpins(spins: number | null): void {
  serverEffectiveAbsenceSpins = spins == null ? null : clampFibonacciAbsenceSpins(spins);
}

export function readFibonacciAbsenceSpinsLocal(): number {
  if (typeof localStorage === "undefined") return DEFAULT_FIBONACCI_ABSENCE_SPINS;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw == null) return DEFAULT_FIBONACCI_ABSENCE_SPINS;
    return clampFibonacciAbsenceSpins(parseInt(raw, 10));
  } catch {
    return DEFAULT_FIBONACCI_ABSENCE_SPINS;
  }
}

export function writeFibonacciAbsenceSpinsLocal(
  spins: number,
  options?: { silent?: boolean },
): void {
  const clamped = clampFibonacciAbsenceSpins(spins);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOCAL_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }
  if (!options?.silent && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT));
  }
}

/** Giros de ausência efectivos (servidor, localStorage ou defeito 12). */
export function readEffectiveFibonacciAbsenceSpins(): number {
  if (serverEffectiveAbsenceSpins != null) return serverEffectiveAbsenceSpins;
  return readFibonacciAbsenceSpinsLocal();
}
