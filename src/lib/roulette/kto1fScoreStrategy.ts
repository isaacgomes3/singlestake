/**
 * KTO · 1 Fator (score pos 1×13 → alerta pos 12).
 *
 * **Contadores:** em cada giro novo, compara posições **1** e **13**.
 * Para cada parâmetro (paridade, cor, altura) que coincidir → +1 vitória
 * (streak; derrotas zera). Se não coincidir → +1 derrota (streak; vitórias zera).
 *
 * **Indicação:** o parâmetro com melhor score (mais vitórias; empate → menos
 * derrotas; depois altura > cor > paridade). O valor alertado vem da **posição 12**
 * (não oposto). Clique num único factor. Gales até 5.
 */

import {
  doisFatoresFactorLabel,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

export const KTO_1F_TABLE_ID = 230;
export const KTO_1F_MESA_URL =
  "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";

/** 1-based newest-first. */
export const KTO_1F_COMPARE_POS_A = 1;
export const KTO_1F_COMPARE_POS_B = 13;
export const KTO_1F_ALERT_POS = 12;
export const KTO_1F_MIN_HISTORY = 13;
export const KTO_1F_MAX_RECOVERY = 5;

export const KTO_1F_RECOVERY_BET_DELAY_MS = 6_000;
export const KTO_1F_IMMEDIATE_REBET_DELAY_MS = 6_000;
export const KTO_1F_FIRST_BET_SETTLE_MS = KTO_1F_RECOVERY_BET_DELAY_MS;
export const KTO_1F_BET_DELAY_MS = KTO_1F_RECOVERY_BET_DELAY_MS;

export const KTO_1F_STAKE_UNITS = [1, 2, 4, 8, 16, 32] as const;

export type Kto1fFactorKind = "paridade" | "cor" | "altura";

export const KTO_1F_FACTOR_KINDS = ["paridade", "cor", "altura"] as const;

export type Kto1fFactorScore = {
  wins: number;
  losses: number;
  /** Último valor observado para o parâmetro (pos 12 / coincidência). */
  last: string | null;
};

export type Kto1fScoreboard = Record<Kto1fFactorKind, Kto1fFactorScore>;

export type Kto1fActive = {
  alertKind: Kto1fFactorKind;
  alertFactor: DoisFatoresFactor;
  scoreWins: number;
  baseNumber: number;
  compareA: number;
  compareB: number;
  armingDescription: string;
};

export type Kto1fCyclePhase = "awaiting_bet" | "awaiting_result";

export type Kto1fCycle = {
  active: Kto1fActive;
  armedHead: string;
  recovery: number;
  phase: Kto1fCyclePhase;
  immediateBet: boolean;
};

export type Kto1fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss";
  alertKind: Kto1fFactorKind;
  alertFactor: DoisFatoresFactor;
  recovery: number;
};

export type Kto1fMachineState = {
  lastSpinHead: string | null;
  scoreboard: Kto1fScoreboard;
  cycle: Kto1fCycle | null;
  pendingRecovery: number;
  betCommitInFlight: boolean;
  totalRounds: number;
};

function emptyScore(): Kto1fFactorScore {
  return { wins: 0, losses: 0, last: null };
}

export function emptyKto1fScoreboard(): Kto1fScoreboard {
  return {
    paridade: emptyScore(),
    cor: emptyScore(),
    altura: emptyScore(),
  };
}

export function defaultKto1fMachineState(): Kto1fMachineState {
  return {
    lastSpinHead: null,
    scoreboard: emptyKto1fScoreboard(),
    cycle: null,
    pendingRecovery: 0,
    betCommitInFlight: false,
    totalRounds: 0,
  };
}

export function emptyKto1fStats(maxRecovery = KTO_1F_MAX_RECOVERY): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(maxRecovery);
}

export function parseKto1fStats(
  raw: unknown,
  maxRecovery = KTO_1F_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, maxRecovery);
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function factorForKind(n: number, kind: Kto1fFactorKind): DoisFatoresFactor | null {
  if (n === 0) return null;
  if (kind === "cor") {
    const v = colorOf(n);
    if (v === "Zero") return null;
    return { kind: "cor", value: v };
  }
  if (kind === "altura") {
    const v = heightOf(n);
    if (v === "Zero") return null;
    return { kind: "altura", value: v };
  }
  const v = parityOf(n);
  if (v === "Zero") return null;
  return { kind: "paridade", value: v };
}

function sharesKind(a: number, b: number, kind: Kto1fFactorKind): boolean {
  const fa = factorForKind(a, kind);
  const fb = factorForKind(b, kind);
  if (!fa || !fb) return false;
  return fa.value === fb.value;
}

function displayLast(f: DoisFatoresFactor | null): string | null {
  if (!f) return null;
  if (f.kind === "paridade") return f.value === "Par" ? "Par" : "Ímpar";
  if (f.kind === "altura") return f.value === "Baixo" ? "Baixo" : "Alto";
  return f.value === "Vermelho" ? "Vermelho" : "Preto";
}

const KIND_TIE_RANK: Record<Kto1fFactorKind, number> = {
  altura: 0,
  cor: 1,
  paridade: 2,
};

/** Melhor score: mais vitórias; empate → menos derrotas; depois altura > cor > paridade. */
export function kto1fBestKind(board: Kto1fScoreboard): Kto1fFactorKind | null {
  let best: Kto1fFactorKind | null = null;
  for (const kind of KTO_1F_FACTOR_KINDS) {
    const s = board[kind];
    if (s.wins <= 0) continue;
    if (!best) {
      best = kind;
      continue;
    }
    const b = board[best];
    if (s.wins > b.wins) best = kind;
    else if (s.wins === b.wins && s.losses < b.losses) best = kind;
    else if (
      s.wins === b.wins &&
      s.losses === b.losses &&
      KIND_TIE_RANK[kind] < KIND_TIE_RANK[best]
    ) {
      best = kind;
    }
  }
  return best;
}

export function kto1fUpdateScoreboard(
  board: Kto1fScoreboard,
  historyNewestFirst: readonly number[],
): Kto1fScoreboard {
  if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return board;
  const n1 = historyNewestFirst[0]!;
  const n13 = historyNewestFirst[12]!;
  const n12 = historyNewestFirst[11]!;
  const next = emptyKto1fScoreboard();
  for (const kind of KTO_1F_FACTOR_KINDS) {
    const prev = board[kind];
    const lastFactor = factorForKind(n12, kind) ?? factorForKind(n1, kind);
    const last = displayLast(lastFactor) ?? prev.last;
    if (n1 === 0 || n13 === 0) {
      next[kind] = { wins: 0, losses: prev.losses + 1, last };
      continue;
    }
    if (sharesKind(n1, n13, kind)) {
      next[kind] = { wins: prev.wins + 1, losses: 0, last };
    } else {
      next[kind] = { wins: 0, losses: prev.losses + 1, last };
    }
  }
  return next;
}

/** Reconstrói o placar a partir do histórico (útil no snapshot inicial). */
export function kto1fPrimeScoreboardFromHistory(
  historyNewestFirst: readonly number[],
): Kto1fScoreboard {
  let board = emptyKto1fScoreboard();
  if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return board;
  // Processa do mais antigo para o mais novo (cada prefixo ≥ 13).
  for (let end = KTO_1F_MIN_HISTORY; end <= historyNewestFirst.length; end++) {
    const slice = historyNewestFirst.slice(0, end);
    // slice is newest-first of the first `end` spins — but chronological update
    // needs each new spin as it arrived. Equivalent: walk from oldest toward newest.
    void slice;
  }
  // Walk chronological: oldest first.
  const chrono = [...historyNewestFirst].reverse();
  for (let i = KTO_1F_MIN_HISTORY - 1; i < chrono.length; i++) {
    const newestFirst = chrono.slice(0, i + 1).reverse();
    board = kto1fUpdateScoreboard(board, newestFirst);
  }
  return board;
}

export function kto1fBuildActiveFromBoard(
  historyNewestFirst: readonly number[],
  board: Kto1fScoreboard,
): Kto1fActive | null {
  if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return null;
  const kind = kto1fBestKind(board);
  if (!kind) return null;
  const n12 = historyNewestFirst[11]!;
  const n1 = historyNewestFirst[0]!;
  const n13 = historyNewestFirst[12]!;
  const alertFactor = factorForKind(n12, kind);
  if (!alertFactor) return null;
  const scoreWins = board[kind].wins;
  return {
    alertKind: kind,
    alertFactor,
    scoreWins,
    baseNumber: n12,
    compareA: n1,
    compareB: n13,
    armingDescription: `1F score ${kind}×${scoreWins}: pos1·${n1}×pos13·${n13} → pos12·${n12} ${doisFatoresFactorLabel(alertFactor)}`,
  };
}

export function kto1fClassifyBetRound(
  result: number,
  active: Kto1fActive,
): "W" | "L" {
  if (result === 0) return "L";
  const f = active.alertFactor;
  if (f.kind === "cor") return colorOf(result) === f.value ? "W" : "L";
  if (f.kind === "altura") return heightOf(result) === f.value ? "W" : "L";
  return parityOf(result) === f.value ? "W" : "L";
}

export function kto1fStakeUnits(recovery: number): number {
  const idx = Math.min(
    Math.max(0, Math.floor(recovery)),
    KTO_1F_STAKE_UNITS.length - 1,
  );
  return KTO_1F_STAKE_UNITS[idx]!;
}

export function kto1fDoubleClicks(recovery: number): number {
  return Math.max(0, Math.floor(recovery));
}

export function kto1fPadFactorPlacementMs(_units: number): number {
  return 0;
}

export function kto1fBetDelayMs(_recovery?: number, immediateBet?: boolean): number {
  return immediateBet === true
    ? KTO_1F_IMMEDIATE_REBET_DELAY_MS
    : KTO_1F_RECOVERY_BET_DELAY_MS;
}

export function kto1fBetDelayUntilMs(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  immediateBet?: boolean,
): number | null {
  const delayMs = kto1fBetDelayMs(recovery, immediateBet);
  return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs)
    ? lastSpinAtMs + delayMs
    : null;
}

export function canPlaceKto1fBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
  immediateBet?: boolean,
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= kto1fBetDelayMs(recovery, immediateBet);
}

function clearCycleKeepGale(
  machine: Kto1fMachineState,
  recoveryToKeep: number,
): Kto1fMachineState {
  return {
    ...machine,
    cycle: null,
    betCommitInFlight: false,
    pendingRecovery: Math.max(0, Math.floor(recoveryToKeep)),
  };
}

function armFromBoard(
  machine: Kto1fMachineState,
  history: readonly number[],
  head: string,
  recovery: number,
): Kto1fMachineState {
  const active = kto1fBuildActiveFromBoard(history, machine.scoreboard);
  if (!active) return machine;
  return {
    ...machine,
    pendingRecovery: 0,
    cycle: {
      active,
      armedHead: head,
      recovery,
      phase: "awaiting_bet",
      immediateBet: recovery > 0,
    },
  };
}

export function tryArmKto1fCycle(
  machine: Kto1fMachineState,
  history: readonly number[],
  head: string,
): Kto1fMachineState {
  if (machine.cycle) return machine;
  if (history.length < KTO_1F_MIN_HISTORY) return machine;
  const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
  return armFromBoard(machine, history, head, pending);
}

export type Kto1fTickResult = {
  machine: Kto1fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Kto1fFlash | null;
  globalActive: Kto1fActive | null;
  globalRecovery: number;
  missedBetWindow?: boolean;
};

export function tickKto1fPlacar(
  historyNewestFirst: readonly number[],
  machine: Kto1fMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = KTO_1F_MAX_RECOVERY,
): Kto1fTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Kto1fMachineState = {
    ...machine,
    lastSpinHead: head,
    scoreboard: { ...machine.scoreboard },
    pendingRecovery: machine.pendingRecovery ?? 0,
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: Kto1fFlash | null = null;
  let missedBetWindow = false;

  if (
    nextMachine.cycle?.phase === "awaiting_bet" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    missedBetWindow = true;
    nextMachine = clearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = kto1fClassifyBetRound(resultNumber, cycle.active);
    const { active, recovery } = cycle;

    if (outcome === "W") {
      nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
      statsChanged = true;
      nextMachine = clearCycleKeepGale(nextMachine, 0);
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        alertKind: active.alertKind,
        alertFactor: active.alertFactor,
        recovery,
      };
    } else {
      const nextRecovery = recovery + 1;
      if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = clearCycleKeepGale(nextMachine, 0);
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          alertKind: active.alertKind,
          alertFactor: active.alertFactor,
          recovery,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          alertKind: active.alertKind,
          alertFactor: active.alertFactor,
          recovery,
        };
        nextMachine = clearCycleKeepGale(nextMachine, nextRecovery);
      }
    }
  }

  if (headChanged && historyNewestFirst.length >= KTO_1F_MIN_HISTORY) {
    nextMachine = {
      ...nextMachine,
      scoreboard: kto1fUpdateScoreboard(nextMachine.scoreboard, historyNewestFirst),
      totalRounds: (nextMachine.totalRounds ?? 0) + 1,
    };
  }

  if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= KTO_1F_MIN_HISTORY) {
    nextMachine = tryArmKto1fCycle(nextMachine, historyNewestFirst, head);
  }

  if (
    !nextMachine.cycle &&
    machine.lastSpinHead == null &&
    historyNewestFirst.length >= KTO_1F_MIN_HISTORY
  ) {
    nextMachine = tryArmKto1fCycle(nextMachine, historyNewestFirst, head);
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ||
    nextMachine.cycle?.phase === "awaiting_result"
      ? nextMachine.cycle.active
      : null;
  const globalRecovery =
    nextMachine.cycle?.recovery ??
    Math.max(0, Math.floor(nextMachine.pendingRecovery ?? 0));

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalRecovery,
    missedBetWindow,
  };
}

export function kto1fKindLabel(kind: Kto1fFactorKind): string {
  if (kind === "paridade") return "Paridade";
  if (kind === "cor") return "Cor";
  return "Altura";
}

export function kto1fWatchLabelForMachine(machine: Kto1fMachineState): string {
  const best = kto1fBestKind(machine.scoreboard);
  if (!best) return "aguarda coincidência 1×13";
  const s = machine.scoreboard[best];
  const gale = machine.cycle?.recovery ?? machine.pendingRecovery ?? 0;
  return `${kto1fKindLabel(best)} ${s.wins}v · gale ${gale}`;
}

export function formatKto1fWatchLabel(_board: Kto1fScoreboard): string {
  return "pos 1×13 · score → alerta pos 12";
}
