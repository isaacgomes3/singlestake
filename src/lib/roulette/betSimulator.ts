// Shared helpers for the live roulette bet simulator.

export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type BetKey =
  | `n:${number}` // straight 0..36 — pays 35:1
  | `col:${1 | 2 | 3}` // column — pays 2:1
  | `doz:${1 | 2 | 3}` // dozen — pays 2:1
  | "low" // 1-18
  | "high" // 19-36
  | "even"
  | "odd"
  | "red"
  | "black";

export type Bets = Record<string, number>;

export function isRed(n: number): boolean {
  return RED_NUMBERS.has(n);
}

/** Returns multiplier of stake to add back when bet wins (stake + profit). 0 if loses. */
export function payoutMultiplier(key: BetKey, spin: number): number {
  if (key.startsWith("n:")) {
    const n = Number(key.slice(2));
    return n === spin ? 36 : 0;
  }
  if (spin === 0) {
    // 0 loses every outside/column/dozen bet
    return 0;
  }
  if (key.startsWith("col:")) {
    const c = Number(key.slice(4));
    const col = ((spin - 1) % 3) + 1; // 1,2,3 (1 in {1,4,7,..}, 2 in {2,5,..}, 3 in {3,6,..})
    return col === c ? 3 : 0;
  }
  if (key.startsWith("doz:")) {
    const d = Number(key.slice(4));
    const dz = spin <= 12 ? 1 : spin <= 24 ? 2 : 3;
    return dz === d ? 3 : 0;
  }
  switch (key) {
    case "low":
      return spin >= 1 && spin <= 18 ? 2 : 0;
    case "high":
      return spin >= 19 && spin <= 36 ? 2 : 0;
    case "even":
      return spin % 2 === 0 ? 2 : 0;
    case "odd":
      return spin % 2 === 1 ? 2 : 0;
    case "red":
      return RED_NUMBERS.has(spin) ? 2 : 0;
    case "black":
      return !RED_NUMBERS.has(spin) ? 2 : 0;
  }
  return 0;
}

/** Returns net P/L (profit - loss) given the bets and spin number. */
export function resolveBets(bets: Bets, spin: number): { totalStake: number; totalReturn: number; net: number } {
  let totalStake = 0;
  let totalReturn = 0;
  for (const [key, amount] of Object.entries(bets)) {
    if (!amount || amount <= 0) continue;
    totalStake += amount;
    totalReturn += amount * payoutMultiplier(key as BetKey, spin);
  }
  return { totalStake, totalReturn, net: totalReturn - totalStake };
}

// ─── persistence ────────────────────────────────────────────────────────────────

export const DEFAULT_BANKROLL = 1000;
export const CHIP_VALUES: readonly number[] = [1, 5, 25, 100];

export interface SimulatorState {
  bankroll: number;
  bets: Bets;
  lastSpinProcessed: number | null;
  history: { spin: number; stake: number; ret: number; net: number; ts: number }[];
  wins: number;
  losses: number;
}

export function freshState(): SimulatorState {
  return {
    bankroll: DEFAULT_BANKROLL,
    bets: {},
    lastSpinProcessed: null,
    history: [],
    wins: 0,
    losses: 0,
  };
}

export function simulatorStorageKey(tableId: number): string {
  return `roulette.betSimulator.v1.${tableId}`;
}

export function readSimulatorState(tableId: number): SimulatorState {
  if (typeof window === "undefined") return freshState();
  try {
    const raw = window.localStorage.getItem(simulatorStorageKey(tableId));
    if (!raw) return freshState();
    const p = JSON.parse(raw) as Partial<SimulatorState>;
    return {
      bankroll: typeof p.bankroll === "number" ? p.bankroll : DEFAULT_BANKROLL,
      bets: p.bets && typeof p.bets === "object" ? (p.bets as Bets) : {},
      lastSpinProcessed:
        typeof p.lastSpinProcessed === "number" ? p.lastSpinProcessed : null,
      history: Array.isArray(p.history) ? p.history.slice(0, 50) : [],
      wins: typeof p.wins === "number" ? p.wins : 0,
      losses: typeof p.losses === "number" ? p.losses : 0,
    };
  } catch {
    return freshState();
  }
}

export function writeSimulatorState(tableId: number, state: SimulatorState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(simulatorStorageKey(tableId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}
