/**
 * Sala Rotativa — sinal activo e placar por estratégia/mesa (rodízio entre mesas do lobby).
 */

import type { RotatingRoomStrategyTab } from "@/lib/roulette/lobbyTables";
import {
  nums28PctActiveFromMirrorSnapshot,
  nums28PctPlacarOutcomes,
  nums28AproveitamentoPctFromHistory,
} from "@/lib/roulette/nums28PctStrategy";
import {
  buildRuas9PctStreetOptsAutoCritical,
  ruas9PctAutoCriticalBundle,
} from "@/lib/roulette/ruas9PctAutoCritical";
import {
  ruas25AproveitamentoPctFromHistory,
  ruas25PctActiveFromSnapshot,
  ruas25PctPlacarOutcomes,
} from "@/lib/roulette/ruas25PctStrategy";
import {
  spinHitsRuas9TargetHalf,
  ruas9TargetHalfZoneLabel,
} from "@/lib/roulette/ruas9TargetHalfAccuracyReport";
import {
  streetStrategyActiveAfterEachChronologicalPrefix,
  simulateStreetStrategy,
  type StreetStrategyActive,
  type ZoneIndication,
} from "@/lib/roulette/streetStrategy";
import type { Ruas25PctActive } from "@/lib/roulette/ruas25PctStrategy";
import type { Nums28PctActive } from "@/lib/roulette/nums28PctStrategy";

export type RotatingRoomPhase = "waiting" | "active";

/** Tempo para se posicionar na mesa antes de aceitar sinal. */
export const ROTATING_ROOM_POSITION_MS = 30_000;
/** Sinal activo mínimo antes de considerar fim por `active`→null (evita flicker). */
export const ROTATING_ROOM_MIN_ACTIVE_MS = 4_000;

export type RotatingRoomMachineState = {
  tableIndex: number;
  phase: RotatingRoomPhase;
  phaseStartedAt: number;
  hadActiveInRound: boolean;
  activeSince: number | null;
  prevOutcomeLen: number;
  /** Verdadeiro após o tempo de posicionamento — libera detecção de sinal. */
  positionGateOpen: boolean;
  /** Impressão do sinal activo ao abrir o portão — ignora-o até mudar ou desaparecer. */
  blockedSignalFingerprint: string | null;
};

export type RotatingRoomSessionStats = {
  wins: number;
  losses: number;
  /** Vitórias por nível de recuperação (0 = sem recuperação). */
  winsAtRecovery?: number[];
  /** Derrotas parciais por nível (antes de avançar recuperação ou perder o ciclo). */
  lossesAtRecovery?: number[];
  /** 1 Fator — acerto por coincidência dos dois giros de gatilho (2 vs 3 factores iguais). */
  umFatorMatchTier?: UmFatorMatchTierStats;
  /** 2 Fatores — acerto por padrão primário / secundário / terciário. */
  crossingPatternKind?: CrossingPatternKindStats;
  /** 2 Fatores — acerto por ausência de cruzamento (cor/altura, paridade/altura). */
  crossingAbsenceAxis?: CrossingAbsenceAxisStats;
  crossingOppositeAbsenceAxis?: CrossingOppositeAbsenceAxisStats;
  /** Fibonacci — acerto por dúzias vs colunas. */
  fibonacciZoneKind?: FibonacciZoneKindStats;
  /** Repetição — acerto por dúzias vs colunas. */
  repeticaoZoneKind?: FibonacciZoneKindStats;
};

export type UmFatorMatchTierBucket = {
  wins: number;
  losses: number;
};

export type UmFatorMatchTierStats = {
  twoEqualFactors: UmFatorMatchTierBucket;
  threeEqualFactors: UmFatorMatchTierBucket;
};

/** 2 Fatores — acerto por tipo de padrão de cruzamento. */
export type CrossingPatternKindStats = {
  primary: UmFatorMatchTierBucket;
  secondary: UmFatorMatchTierBucket;
  tertiary: UmFatorMatchTierBucket;
};

/** 2 Fatores — acerto por eixo de ausência de cruzamento. */
export type CrossingAbsenceAxisStats = {
  corAltura: UmFatorMatchTierBucket;
  alturaParidade: UmFatorMatchTierBucket;
};

/** 2 Fatores — acerto por eixo de ausência oposta (aposta no cruzamento oposto). */
export type CrossingOppositeAbsenceAxisStats = {
  corAltura: UmFatorMatchTierBucket;
  alturaParidade: UmFatorMatchTierBucket;
};

/** Fibonacci — acerto por dúzias vs colunas. */
export type FibonacciZoneKindStats = {
  dozen: UmFatorMatchTierBucket;
  column: UmFatorMatchTierBucket;
};

/** Metade alvo Ruas 9% por mesa (quadro da sala rotativa). */
export type RotatingRoomTargetHalfBoardEntry = {
  tableId: number;
  hasActive: boolean;
  zone: ZoneIndication | null;
  zoneLabel: string | null;
  isCurrentTable: boolean;
  signalLive: boolean;
  /** Segundos restantes da janela de entrada (20s após o último giro). */
  entryRemainingSec: number;
  entryWindowOpen: boolean;
};

export type RotatingRoomSnapshot =
  | { strategy: "ruas9pct"; hasActive: boolean; active: StreetStrategyActive | null; ruas9CriticalLabel: string }
  | { strategy: "ruas25pct"; hasActive: boolean; active: Ruas25PctActive | null }
  | { strategy: "nums28pct"; hasActive: boolean; active: Nums28PctActive | null };

const STATS_STORAGE_PREFIX = "roulette.rotatingRoom.stats.v1.";
const MACHINE_STORAGE_PREFIX = "roulette.rotatingRoom.machine.v1.";

export const ROTATING_ROOM_MACHINE_CHANGED_EVENT = "rotating-room-machine-changed";

function defaultRotatingRoomMachineState(): RotatingRoomMachineState {
  return {
    tableIndex: 0,
    phase: "waiting",
    phaseStartedAt: Date.now(),
    hadActiveInRound: false,
    activeSince: null,
    prevOutcomeLen: 0,
    positionGateOpen: false,
    blockedSignalFingerprint: null,
  };
}

function machineStorageKey(tab: RotatingRoomStrategyTab): string {
  return MACHINE_STORAGE_PREFIX + tab;
}

export function readRotatingRoomMachineState(
  tab: RotatingRoomStrategyTab,
  tableCount: number,
): RotatingRoomMachineState {
  if (typeof window === "undefined") return defaultRotatingRoomMachineState();
  try {
    const raw = sessionStorage.getItem(machineStorageKey(tab));
    if (!raw) return defaultRotatingRoomMachineState();
    const o = JSON.parse(raw) as RotatingRoomMachineState;
    const len = Math.max(0, tableCount);
    const tableIndex =
      len > 0 ? ((Number(o.tableIndex) || 0) % len + len) % len : 0;
    const phase: RotatingRoomPhase = o.phase === "active" ? "active" : "waiting";
    const legacyAwaitNext = Boolean((o as { awaitNextSignal?: boolean }).awaitNextSignal);
    let positionGateOpen = Boolean(o.positionGateOpen);
    let blockedSignalFingerprint =
      o.blockedSignalFingerprint == null ? null : String(o.blockedSignalFingerprint);
    // Estado antigo podia ficar preso em «aguardar» — reinicia posicionamento.
    if (legacyAwaitNext && o.blockedSignalFingerprint == null) {
      positionGateOpen = false;
      blockedSignalFingerprint = null;
    }
    // Fingerprint antigo da 2,8% (sem giro/indicação) — reinicia posicionamento.
    if (
      tab === "nums28pct" &&
      positionGateOpen &&
      blockedSignalFingerprint != null &&
      blockedSignalFingerprint.startsWith("nums28:") &&
      !blockedSignalFingerprint.includes("Números 2,8%")
    ) {
      positionGateOpen = false;
      blockedSignalFingerprint = null;
    }
    return {
      tableIndex,
      phase,
      phaseStartedAt: Number(o.phaseStartedAt) || Date.now(),
      hadActiveInRound: Boolean(o.hadActiveInRound),
      activeSince: o.activeSince == null ? null : Number(o.activeSince) || null,
      prevOutcomeLen: Number(o.prevOutcomeLen) || 0,
      positionGateOpen,
      blockedSignalFingerprint,
    };
  } catch {
    return defaultRotatingRoomMachineState();
  }
}

export function writeRotatingRoomMachineState(
  tab: RotatingRoomStrategyTab,
  state: RotatingRoomMachineState,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(machineStorageKey(tab), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_MACHINE_CHANGED_EVENT, { detail: { tab } }));
}

export function resetRotatingRoomMachineState(tab: RotatingRoomStrategyTab): void {
  writeRotatingRoomMachineState(tab, defaultRotatingRoomMachineState());
}

/** Identifica a indicação activa — usada para ignorar o sinal presente ao fim da contagem. */
export function rotatingRoomSignalFingerprint(
  snapshot: RotatingRoomSnapshot,
  historyNewestFirst?: readonly number[],
): string | null {
  if (!snapshot.hasActive) return null;
  if (snapshot.strategy === "ruas9pct") {
    const a = snapshot.active;
    if (!a) return null;
    const head =
      historyNewestFirst && historyNewestFirst.length > 0
        ? `${historyNewestFirst.length}:${historyNewestFirst[0]}`
        : "0";
    return `ruas9-half:${a.zone}:${a.triggerNewerNumber}:${head}`;
  }
  if (snapshot.strategy === "ruas25pct") {
    const a = snapshot.active;
    if (!a) return null;
    const head =
      historyNewestFirst && historyNewestFirst.length > 0
        ? `${historyNewestFirst.length}:${historyNewestFirst[0]}`
        : "0";
    return `ruas25:${head}:${a.excludedGroupId}:${a.excludedNumbers.join(",")}`;
  }
  const a = snapshot.active;
  if (!a) return null;
  // Números 2,8% recalcula a cada giro — inclui o topo do histórico para detectar o próximo sinal.
  const head =
    historyNewestFirst && historyNewestFirst.length > 0
      ? `${historyNewestFirst.length}:${historyNewestFirst[0]}`
      : String(a.criticalTriple[2]);
  return `nums28:${head}:${a.armingDescription}`;
}

export function rotatingRoomStrategyLabel(tab: RotatingRoomStrategyTab): string {
  switch (tab) {
    case "ruas9pct":
      return "Ruas 9%";
    case "ruas25pct":
      return "Ruas 25%";
    case "nums28pct":
      return "Números 2,8%";
    case "um1fator":
      return "1 Fator";
  }
}

export function rotatingRoomStrategyRoute(tab: RotatingRoomStrategyTab): string {
  return "/sala-rotativa-um-fator";
}

export function readRotatingRoomSessionStats(tab: RotatingRoomStrategyTab): RotatingRoomSessionStats {
  if (typeof window === "undefined") return { wins: 0, losses: 0 };
  try {
    const raw = sessionStorage.getItem(STATS_STORAGE_PREFIX + tab);
    if (!raw) return { wins: 0, losses: 0 };
    const o = JSON.parse(raw) as RotatingRoomSessionStats;
    return {
      wins: Number(o.wins) || 0,
      losses: Number(o.losses) || 0,
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

export function writeRotatingRoomSessionStats(
  tab: RotatingRoomStrategyTab,
  stats: RotatingRoomSessionStats,
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STATS_STORAGE_PREFIX + tab, JSON.stringify(stats));
}

export function resetRotatingRoomSessionStats(tab: RotatingRoomStrategyTab): void {
  writeRotatingRoomSessionStats(tab, { wins: 0, losses: 0 });
  resetRotatingRoomMachineState(tab);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("rotating-room-stats-reset", { detail: { tab } }));
  }
}

/** Placar Ruas 9% na sala rotativa: acerto/erro na **metade alvo** (`active.zone`). */
export function rotatingRoomRuas9TargetHalfOutcomes(
  historyNewestFirst: readonly number[],
  tableId: number,
): ("W" | "L")[] {
  if (historyNewestFirst.length < 2) return [];

  const chronological = [...historyNewestFirst].reverse();
  const opts = buildRuas9PctStreetOptsAutoCritical(historyNewestFirst, `rotating-ruas9-${tableId}`);
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, opts);
  const out: ("W" | "L")[] = [];

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;
    const num = chronological[k]!;
    out.push(spinHitsRuas9TargetHalf(num, active.zone) ? "W" : "L");
  }
  return out;
}

export function rotatingRoomTargetHalfBoard(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  entriesByTable?: ReadonlyMap<number, { entryRemainingSec: number; entryWindowOpen: boolean; signalLive: boolean }>,
): RotatingRoomTargetHalfBoardEntry[] {
  return tableIds.map((tableId) => {
    const snap = rotatingRoomSnapshotForTable("ruas9pct", histories[tableId] ?? [], tableId);
    const zone = snap.hasActive && snap.active ? snap.active.zone : null;
    const extra = entriesByTable?.get(tableId);
    const signalLive = extra?.signalLive ?? (snap.hasActive && (extra?.entryWindowOpen ?? false));
    return {
      tableId,
      hasActive: snap.hasActive,
      zone,
      zoneLabel: zone ? ruas9TargetHalfZoneLabel(zone) : null,
      isCurrentTable: false,
      signalLive,
      entryRemainingSec: extra?.entryRemainingSec ?? 0,
      entryWindowOpen: extra?.entryWindowOpen ?? false,
    };
  });
}

export function rotatingRoomPlacarOutcomes(
  strategy: RotatingRoomStrategyTab,
  historyNewestFirst: readonly number[],
  tableId: number,
): ("W" | "L" | "D")[] {
  const h = [...historyNewestFirst];
  if (strategy === "ruas9pct") {
    return rotatingRoomRuas9TargetHalfOutcomes(h, tableId);
  }
  if (strategy === "ruas25pct") return ruas25PctPlacarOutcomes(h);
  return nums28PctPlacarOutcomes(h);
}

export function rotatingRoomSnapshotForTable(
  strategy: RotatingRoomStrategyTab,
  historyNewestFirst: readonly number[],
  tableId: number,
): RotatingRoomSnapshot {
  if (strategy === "ruas9pct") {
    const auto = ruas9PctAutoCriticalBundle(historyNewestFirst, `rotating-ruas9-${tableId}`);
    const { active } = simulateStreetStrategy(historyNewestFirst, auto.opts);
    return {
      strategy: "ruas9pct",
      hasActive: active != null,
      active,
      ruas9CriticalLabel: auto.criticalLabel,
    };
  }
  if (strategy === "ruas25pct") {
    const active = ruas25PctActiveFromSnapshot(historyNewestFirst);
    return { strategy: "ruas25pct", hasActive: active != null, active };
  }
  if (strategy === "dois2fatores" || strategy === "um1fator") {
    return { strategy: "nums28pct", hasActive: false, active: null };
  }
  const active = nums28PctActiveFromMirrorSnapshot(historyNewestFirst);
  return { strategy: "nums28pct", hasActive: active != null, active };
}

export function rotatingRoomSessionAproveitamentoPct(stats: RotatingRoomSessionStats): number {
  const d = stats.wins + stats.losses;
  if (d === 0) return 0;
  return (100 * stats.wins) / d;
}

/** Aproveitamento acumulado global da estratégia na mesa (referência no cartão). */
export function rotatingRoomTableGlobalPct(
  strategy: RotatingRoomStrategyTab,
  historyNewestFirst: readonly number[],
  tableId: number,
): number {
  const h = [...historyNewestFirst];
  if (strategy === "ruas9pct") {
    const outcomes = rotatingRoomRuas9TargetHalfOutcomes(h, tableId);
    if (outcomes.length === 0) return 0;
    return (100 * outcomes.filter((x) => x === "W").length) / outcomes.length;
  }
  if (strategy === "ruas25pct") return ruas25AproveitamentoPctFromHistory(h);
  return nums28AproveitamentoPctFromHistory(h);
}
