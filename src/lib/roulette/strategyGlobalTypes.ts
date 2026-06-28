import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type { RotatingRoomCrossingTableScan, RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { UmFatorTableScan } from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type { DoisFatoresActive, DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import type { UmFatorActive } from "@/lib/roulette/umFatorStrategy";
import type { RotatingRoomPhase } from "@/lib/roulette/rotatingRoomStrategy";

export type StrategyGlobalKind = "dois2fatores" | "um1fator";

export type StrategyGlobalLedgerEntry = {
  ts: number;
  tableId: number;
  won: boolean;
  /** Nível de proteção/recuperação antes desta liquidação. */
  recovery: number;
  kind: "win" | "loss" | "recovery";
  resultNumber?: number;
  factor1?: DoisFatoresFactor;
  factor2?: DoisFatoresFactor;
  triggerNumbers?: number[];
  bucketGap?: number;
};

export type StrategyGlobalLifetimeAggregate = {
  /** Primeiro resultado registado (epoch ms). */
  since: number;
  wins: number;
  losses: number;
  winsAtRecovery: number[];
  lossesAtRecovery: number[];
};

export type StrategyGlobalCrossingClientView = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  currentRecovery: number;
  currentTableId: number | null;
  prepareTableId: number | null;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: RotatingRoomSessionMode;
  prepareCategory: string | null;
  crossingScan: RotatingRoomCrossingTableScan[];
  activeCrossing: DoisFatoresActive | null;
};

export type StrategyGlobalUmFatorClientView = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  singleFactorMode: true;
  currentRecovery: number;
  currentTableId: number | null;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: "scanning" | "active";
  umFatorScan: UmFatorTableScan[];
  activeCrossing: DoisFatoresActive | null;
  umActive: UmFatorActive | null;
  lobbyCooldownUntilMs: number | null;
  postResultHoldUntilMs: number | null;
  postResultHoldTableId: number | null;
};

/** Snapshot servido a todos os clientes (fonte única de verdade). */
export type StrategyGlobalSnapshot = {
  revision: number;
  updatedAt: number;
  rotatingRoomTableIds: number[];
  tableHistories: Record<number, number[]>;
  dois2fatores: StrategyGlobalCrossingClientView;
  um1fator: StrategyGlobalUmFatorClientView;
  lifetime: Record<StrategyGlobalKind, StrategyGlobalLifetimeAggregate>;
  /** Últimas entradas liquidadas (para painel de estatísticas). */
  ledgerTail: Record<StrategyGlobalKind, StrategyGlobalLedgerEntry[]>;
  /** Extensão Chrome a sincronizar o motor Um Fator (prioridade sobre DGA do servidor). */
  extensionSource?: {
    active: boolean;
    lastSyncAt: number | null;
    autopilotRunning: boolean;
  };
};

export type StrategyGlobalFlashPayload = {
  dois2fatores: {
    resultNumber: number;
    won: boolean;
    tableId: number;
    kind: "win" | "loss" | "recovery";
  } | null;
  um1fator: {
    resultNumber: number;
    won: boolean;
    tableId: number;
    kind: "win" | "loss" | "recovery";
  } | null;
};

export type StrategyGlobalStreamMessage =
  | { type: "sync"; snapshot: StrategyGlobalSnapshot }
  | {
      type: "update";
      revision: number;
      snapshot: StrategyGlobalSnapshot;
      flashes?: StrategyGlobalFlashPayload;
    };
