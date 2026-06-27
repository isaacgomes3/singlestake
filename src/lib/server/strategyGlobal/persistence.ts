import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  emptyRecoveryLevelCounts,
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";
import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  type RotatingRoomCrossingMachineState,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import { defaultRotatingRoomCrossingMachineState } from "@/lib/roulette/rotatingRoomCrossingSession";
import {
  UM_FATOR_MAX_RECOVERY,
  defaultUmFatorMachineState,
  normalizeUmFatorMachineOnLoad,
  type UmFatorMachineState,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type {
  StrategyGlobalKind,
  StrategyGlobalLedgerEntry,
  StrategyGlobalLifetimeAggregate,
} from "@/lib/roulette/strategyGlobalTypes";

const MAX_HISTORY_PER_TABLE = 4_000;
const MAX_LEDGER_ENTRIES = 20_000;
const PERSIST_DEBOUNCE_MS = 800;

export type StrategyGlobalPersistedState = {
  version: 1;
  revision: number;
  updatedAt: number;
  rotatingRoomTableIds: number[];
  tableHistories: Record<string, number[]>;
  lastProcessedGameIds: string[];
  dois2fatores: {
    machine: RotatingRoomCrossingMachineState;
    stats: RotatingRoomSessionStats;
  };
  um1fator: {
    machine: UmFatorMachineState;
    stats: RotatingRoomSessionStats;
  };
  lifetime: Record<StrategyGlobalKind, StrategyGlobalLifetimeAggregate>;
  ledger: Record<StrategyGlobalKind, StrategyGlobalLedgerEntry[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __strategyGlobalPersisted: StrategyGlobalPersistedState | undefined;
  // eslint-disable-next-line no-var
  var __strategyGlobalSaveTimer: ReturnType<typeof setTimeout> | undefined;
}

function defaultLifetime(): StrategyGlobalLifetimeAggregate {
  return {
    since: Date.now(),
    wins: 0,
    losses: 0,
    winsAtRecovery: emptyRecoveryLevelCounts(ROTATING_ROOM_CROSSING_MAX_RECOVERY),
    lossesAtRecovery: emptyRecoveryLevelCounts(ROTATING_ROOM_CROSSING_MAX_RECOVERY),
  };
}

export function emptyStrategyGlobalState(tableIds: readonly number[]): StrategyGlobalPersistedState {
  const now = Date.now();
  return {
    version: 1,
    revision: 0,
    updatedAt: now,
    rotatingRoomTableIds: [...tableIds],
    tableHistories: {},
    lastProcessedGameIds: [],
    dois2fatores: {
      machine: defaultRotatingRoomCrossingMachineState(),
      stats: emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY),
    },
    um1fator: {
      machine: defaultUmFatorMachineState(),
      stats: emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY),
    },
    lifetime: {
      dois2fatores: { ...defaultLifetime(), since: now },
      um1fator: {
        ...defaultLifetime(),
        since: now,
        winsAtRecovery: emptyRecoveryLevelCounts(UM_FATOR_MAX_RECOVERY),
        lossesAtRecovery: emptyRecoveryLevelCounts(UM_FATOR_MAX_RECOVERY),
      },
    },
    ledger: { dois2fatores: [], um1fator: [] },
  };
}

function parseMachine(raw: unknown): RotatingRoomCrossingMachineState {
  return { ...defaultRotatingRoomCrossingMachineState(), ...(raw as object) };
}

function parseUmMachine(raw: unknown, stats: RotatingRoomSessionStats): UmFatorMachineState {
  return normalizeUmFatorMachineOnLoad(
    {
      ...defaultUmFatorMachineState(),
      ...(raw as object),
    },
    stats,
  );
}

function parseLifetime(raw: unknown, maxRecovery: number): StrategyGlobalLifetimeAggregate {
  const o = (raw ?? {}) as Partial<StrategyGlobalLifetimeAggregate>;
  return {
    since: Number(o.since) || Date.now(),
    wins: Math.max(0, Number(o.wins) || 0),
    losses: Math.max(0, Number(o.losses) || 0),
    winsAtRecovery: Array.isArray(o.winsAtRecovery)
      ? o.winsAtRecovery.map((n) => Math.max(0, Number(n) || 0)).slice(0, maxRecovery + 1)
      : emptyRecoveryLevelCounts(maxRecovery),
    lossesAtRecovery: Array.isArray(o.lossesAtRecovery)
      ? o.lossesAtRecovery.map((n) => Math.max(0, Number(n) || 0)).slice(0, maxRecovery + 1)
      : emptyRecoveryLevelCounts(maxRecovery),
  };
}

export function parsePersistedState(
  raw: unknown,
  fallbackTableIds: readonly number[],
): StrategyGlobalPersistedState {
  const base = emptyStrategyGlobalState(fallbackTableIds);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<StrategyGlobalPersistedState>;
  return {
    version: 1,
    revision: Math.max(0, Number(o.revision) || 0),
    updatedAt: Number(o.updatedAt) || Date.now(),
    rotatingRoomTableIds:
      Array.isArray(o.rotatingRoomTableIds) && o.rotatingRoomTableIds.length > 0
        ? o.rotatingRoomTableIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
        : [...fallbackTableIds],
    tableHistories:
      o.tableHistories && typeof o.tableHistories === "object"
        ? (o.tableHistories as Record<string, number[]>)
        : {},
    lastProcessedGameIds: Array.isArray(o.lastProcessedGameIds)
      ? o.lastProcessedGameIds.map(String).slice(-2_000)
      : [],
    dois2fatores: {
      machine: parseMachine(o.dois2fatores?.machine),
      stats: parseRotatingRoomSessionStats(o.dois2fatores?.stats, ROTATING_ROOM_CROSSING_MAX_RECOVERY),
    },
    um1fator: (() => {
      const umStats = parseRotatingRoomSessionStats(o.um1fator?.stats, UM_FATOR_MAX_RECOVERY);
      return {
        stats: umStats,
        machine: parseUmMachine(o.um1fator?.machine, umStats),
      };
    })(),
    lifetime: {
      dois2fatores: parseLifetime(o.lifetime?.dois2fatores, ROTATING_ROOM_CROSSING_MAX_RECOVERY),
      um1fator: parseLifetime(o.lifetime?.um1fator, UM_FATOR_MAX_RECOVERY),
    },
    ledger: {
      dois2fatores: Array.isArray(o.ledger?.dois2fatores)
        ? (o.ledger!.dois2fatores as StrategyGlobalLedgerEntry[]).slice(-MAX_LEDGER_ENTRIES)
        : [],
      um1fator: Array.isArray(o.ledger?.um1fator)
        ? (o.ledger!.um1fator as StrategyGlobalLedgerEntry[]).slice(-MAX_LEDGER_ENTRIES)
        : [],
    },
  };
}

function storagePath(): string {
  return (
    process.env.ROULETTE_STRATEGY_GLOBAL_PATH?.trim() ||
    join(process.cwd(), "data", "roulette-strategy-global.json")
  );
}

async function loadFromDisk(): Promise<StrategyGlobalPersistedState | null> {
  try {
    const raw = await readFile(storagePath(), "utf8");
    return JSON.parse(raw) as StrategyGlobalPersistedState;
  } catch {
    return null;
  }
}

async function saveToDisk(state: StrategyGlobalPersistedState): Promise<void> {
  try {
    const path = storagePath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(state), "utf8");
  } catch (err) {
    console.warn("[StrategyGlobal] persistência em disco falhou:", err);
  }
}

export function getStrategyGlobalState(): StrategyGlobalPersistedState {
  if (!globalThis.__strategyGlobalPersisted) {
    throw new Error("Strategy global não inicializado no servidor");
  }
  return globalThis.__strategyGlobalPersisted;
}

export async function initStrategyGlobalState(fallbackTableIds: readonly number[]): Promise<void> {
  if (globalThis.__strategyGlobalPersisted) return;
  try {
    const fromDisk = await loadFromDisk();
    globalThis.__strategyGlobalPersisted = parsePersistedState(fromDisk, fallbackTableIds);
  } catch (err) {
    console.warn("[StrategyGlobal] estado em disco inválido — a reiniciar:", err);
    globalThis.__strategyGlobalPersisted = emptyStrategyGlobalState(fallbackTableIds);
  }
  console.info(
    "[StrategyGlobal] estado carregado — revisão",
    globalThis.__strategyGlobalPersisted.revision,
    "mesas",
    globalThis.__strategyGlobalPersisted.rotatingRoomTableIds.length,
  );
}

export function replaceStrategyGlobalState(next: StrategyGlobalPersistedState): void {
  globalThis.__strategyGlobalPersisted = next;
  schedulePersist(next);
}

export function schedulePersist(state: StrategyGlobalPersistedState): void {
  if (globalThis.__strategyGlobalSaveTimer != null) {
    clearTimeout(globalThis.__strategyGlobalSaveTimer);
  }
  globalThis.__strategyGlobalSaveTimer = setTimeout(() => {
    globalThis.__strategyGlobalSaveTimer = undefined;
    void saveToDisk(state);
  }, PERSIST_DEBOUNCE_MS);
}

export function historiesRecord(
  state: StrategyGlobalPersistedState,
): Record<number, readonly number[]> {
  const out: Record<number, readonly number[]> = {};
  for (const id of state.rotatingRoomTableIds) {
    out[id] = state.tableHistories[String(id)] ?? [];
  }
  return out;
}

export function appendTableSpin(
  state: StrategyGlobalPersistedState,
  tableId: number,
  number: number,
): void {
  const key = String(tableId);
  const prev = state.tableHistories[key] ?? [];
  state.tableHistories[key] = [number, ...prev].slice(0, MAX_HISTORY_PER_TABLE);
}

export function rememberGameId(state: StrategyGlobalPersistedState, gameId: string): boolean {
  if (state.lastProcessedGameIds.includes(gameId)) return false;
  state.lastProcessedGameIds = [...state.lastProcessedGameIds, gameId].slice(-2_000);
  return true;
}

export function appendLedger(
  state: StrategyGlobalPersistedState,
  kind: StrategyGlobalKind,
  entry: StrategyGlobalLedgerEntry,
  maxRecovery: number,
): void {
  if (entry.resultNumber != null) {
    const spinKey = `${entry.tableId}:${entry.resultNumber}`;
    const duplicate = state.ledger[kind].some(
      (existing) =>
        existing.resultNumber != null &&
        `${existing.tableId}:${existing.resultNumber}` === spinKey,
    );
    if (duplicate) return;
  }

  const list = [...state.ledger[kind], entry].slice(-MAX_LEDGER_ENTRIES);
  state.ledger[kind] = list;
  const life = state.lifetime[kind];
  if (entry.kind === "win") {
    life.wins += 1;
    const r = Math.min(maxRecovery, Math.max(0, entry.recovery));
    life.winsAtRecovery[r] = (life.winsAtRecovery[r] ?? 0) + 1;
  } else if (entry.kind === "loss") {
    life.losses += 1;
    const r = Math.min(maxRecovery, Math.max(0, entry.recovery));
    life.lossesAtRecovery[r] = (life.lossesAtRecovery[r] ?? 0) + 1;
  }
}
