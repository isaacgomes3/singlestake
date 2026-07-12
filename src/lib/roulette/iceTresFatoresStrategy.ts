/**
 * ICE · 3 Fatores (eco) — aposta **cor + altura + paridade** (3 unidades).
 *
 * **Gatilho:** no número mais recente do histórico, procura a **última ocorrência**
 * anterior desse mesmo número. Alerta os **3 factores** do número imediatamente
 * à **esquerda** dessa ocorrência (mais recente que ela na grelha newest-first).
 *
 * Ex.: histórico [22, 5, 8, 22, …] → recente 22, ocorrência anterior na pos4,
 * número à esquerda = 8 → aposta cor/altura/paridade do 8 (3 un.).
 *
 * **Placar:** vitória se acertar ≥2 factores.
 * Derrota parcial (1 factor / falham 2) → **+1 gale (×2)**.
 * Derrota total (0 factores ou zero / falham 3) → **+2 gales consecutivos (×4)**.
 * Após derrota fecha a indicação e espera **novo eco** com a escala pendente.
 * Recuperação até **5 gales**; depois → derrota final.
 */

import {
  doisFatoresFactorLabel,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";

export const ICE_3F_ROULETTE_TABLE_ID = 201;
export const ICE_3F_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

/** @deprecated UI legado — gatilho já não usa posições fixas. */
export const ICE_3F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11] as const;

/** Precisa de recente + ocorrência anterior + nº à esquerda (mín. 2 giros; típico ≥3). */
export const ICE_3F_MIN_HISTORY = 3;
/** @deprecated Contadores de observação removidos. */
export const ICE_3F_REQUIRED_TOTAL_DEFEATS = 2;
/** @deprecated Contadores de observação removidos. */
export const ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL = 3;
/** Factores / unidades na aposta de entrada. */
export const ICE_3F_FACTORS_PER_BET = 3;
export const ICE_3F_GALE_MULTIPLIER = 2;
/** Derrota total — avança 2 gales sobre a última entrada (×4: 1→4, 2→8…). */
export const ICE_3F_TOTAL_LOSS_MULTIPLIER = 4;
export const ICE_3F_GALE3_REFERENCE_UNITS = 8;
export const ICE_3F_CHIP_CLICK_STAGGER_MS = 150;
export const ICE_3F_BET_DELAY_MS = 5_000;
export const ICE_3F_FIRST_BET_SETTLE_MS = ICE_3F_BET_DELAY_MS;
export const ICE_3F_RECOVERY_BET_DELAY_MS = ICE_3F_BET_DELAY_MS;
/** Máximo de gales após a entrada (recuperação). */
export const ICE_3F_MAX_GALES = 5;
/**
 * Soma das unidades num ciclo completo (entrada + 5 gales a partir de 1u):
 * 1+2+4+8+16+32 = 63. A cada 63 vitórias no modo auto, dobra a entrada.
 */
export const ICE_3F_WINS_PER_ENTRY_BUMP = 63;
export const ICE_3F_FULL_CYCLE_UNITS = 63;
export const ICE_3F_MAX_ENTRY_UNITS = 32;
/** @deprecated Usar {@link ICE_3F_MAX_GALES}. */
export const ICE_3F_MAX_GALE_STREAK = ICE_3F_MAX_GALES;
/** @deprecated Sem limite de triplas — só {@link ICE_3F_MAX_GALES}. */
export const ICE_3F_MAX_CONSECUTIVE_TRIPLES = Number.POSITIVE_INFINITY;
/** @deprecated Sem limite de triplas. */
export const ICE_3F_GALES_AFTER_TRIPLE_LIMIT = Number.POSITIVE_INFINITY;

/** @deprecated */
export type Ice3fCriticalPosition = number;

export type Ice3fMatchOutcome =
  | "total_win"
  | "partial_win"
  | "partial_loss"
  | "total_loss";

/** Três factores: cor + altura + paridade. */
export type Ice3fTripleFactors = readonly [
  DoisFatoresFactor,
  DoisFatoresFactor,
  DoisFatoresFactor,
];
/** @deprecated Alias — usar {@link Ice3fTripleFactors}. */
export type Ice3fPairFactors = Ice3fTripleFactors;

export type Ice3fEchoHit = {
  /** Número mais recente (history[0]). */
  recentNumber: number;
  /** Índice 0-based da ocorrência anterior do recente. */
  priorIndex: number;
  /** Índice 0-based do nº à esquerda dessa ocorrência. */
  signalIndex: number;
  /** Número cujos 3 factores se apostam. */
  signalNumber: number;
  /** Posição 1-based do sinal na grelha. */
  signalPosition: number;
};

export type Ice3fActive = {
  /** Posição 1-based do nº sinal (à esquerda da última ocorrência). */
  criticalPosition: number;
  factors: Ice3fTripleFactors;
  referenceNumber: number;
  armingDescription: string;
  triggerNumber?: number;
  priorOccurrencePosition?: number;
};

export type Ice3fCyclePhase = "awaiting_bet" | "awaiting_result";

export type Ice3fCycle = {
  active: Ice3fActive;
  armedHead: string;
  unitScale: number;
  /** 0 = entrada; 1…{@link ICE_3F_MAX_GALES} = gale. */
  galeStreak: number;
  consecutiveTriples: number;
  galesSinceTriple: number;
  phase: Ice3fCyclePhase;
};

/** Stub de UI legado. */
export type Ice3fWatchSlot = { total: number; partial: number };
export type Ice3fWatchCounters = Record<number, Ice3fWatchSlot>;

export type Ice3fStakeMode = "auto" | "manual";

export type Ice3fMachineState = {
  cycle: Ice3fCycle | null;
  watch: Ice3fWatchCounters;
  pendingCritical: number | null;
  lastSpinHead: string | null;
  betCommitInFlight?: boolean;
  /** Escala de gale a aplicar na próxima indicação (eco novo). */
  pendingUnitScale?: number;
  pendingGaleStreak?: number;
  pendingConsecutiveTriples?: number;
  pendingGalesSinceTriple?: number;
  /** Unidades de entrada (1, 2, 4, …) — ficha base × Dobrar. */
  entryUnits?: number;
  /** auto: sobe a cada 63 vitórias; manual: só via UI. */
  stakeMode?: Ice3fStakeMode;
  /** Vitórias desde o último aumento de entrada (modo auto). */
  winsTowardEntryBump?: number;
};

export type Ice3fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "cycle_fail";
  matchOutcome: Ice3fMatchOutcome;
  criticalPosition: number;
  unitScale: number;
  factors: Ice3fTripleFactors;
};

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function factorWins(num: number, factor: DoisFatoresFactor): boolean {
  if (num === 0) return false;
  switch (factor.kind) {
    case "cor":
      return colorOf(num) === factor.value;
    case "altura":
      return heightOf(num) === factor.value;
    case "paridade":
      return parityOf(num) === factor.value;
  }
}

/** Factores da indicação: cor + altura + paridade. */
export function ice3fTripleForNumber(n: number): Ice3fTripleFactors | null {
  if (n === 0) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  const par = parityOf(n);
  if (col === "Zero" || alt === "Zero" || par === "Zero") return null;
  return [
    { kind: "cor", value: col },
    { kind: "altura", value: alt },
    { kind: "paridade", value: par },
  ] as const;
}

/** @deprecated Usar {@link ice3fTripleForNumber}. */
export function ice3fPairForNumber(n: number): Ice3fTripleFactors | null {
  return ice3fTripleForNumber(n);
}

export function ice3fMatchCount(result: number, ref: number): number {
  if (result === 0 || ref === 0) return 0;
  const triple = ice3fTripleForNumber(ref);
  if (!triple) return 0;
  return triple.filter((f) => factorWins(result, f)).length;
}

export function ice3fClassifyMatch(result: number, ref: number): Ice3fMatchOutcome | null {
  if (result === 0 || ref === 0) return null;
  const count = ice3fMatchCount(result, ref);
  if (count === 3) return "total_win";
  if (count === 2) return "partial_win";
  if (count === 1) return "partial_loss";
  return "total_loss";
}

export function ice3fClassifyBetRound(result: number, ref: number): Ice3fMatchOutcome | null {
  if (ref === 0) return null;
  if (result === 0) return "total_loss";
  return ice3fClassifyMatch(result, ref);
}

/** Acertos 0…3 a partir do outcome do placar. */
export function ice3fHitsForOutcome(outcome: Ice3fMatchOutcome): number {
  switch (outcome) {
    case "total_win":
      return 3;
    case "partial_win":
      return 2;
    case "partial_loss":
      return 1;
    case "total_loss":
      return 0;
  }
}

/**
 * PnL líquido: cada factor paga **1:1** sobre `totalStake / 3`.
 * Ex.: ficha 50 → total 150 → 3 acertos +150; 2 acertos +50; 1 acerto −50; 0 → −150.
 */
export function ice3fSettlementNet(totalStake: number, factorHits: number): number {
  const stake = Math.max(0, totalStake);
  if (!(stake > 0) || !Number.isFinite(stake)) return 0;
  const hits = Math.max(
    0,
    Math.min(ICE_3F_FACTORS_PER_BET, Math.floor(factorHits)),
  );
  const perFactor = stake / ICE_3F_FACTORS_PER_BET;
  return (2 * hits - ICE_3F_FACTORS_PER_BET) * perFactor;
}

export function normalizeIce3fWatchSlot(
  raw: Ice3fWatchSlot | number | null | undefined,
): Ice3fWatchSlot {
  if (typeof raw === "number") return { total: Math.max(0, raw), partial: 0 };
  return {
    total: Math.max(0, raw?.total ?? 0),
    partial: Math.max(0, raw?.partial ?? 0),
  };
}

/** @deprecated Gatilho eco — sempre false. */
export function ice3fIsPositionArmed(
  _raw: Ice3fWatchSlot | number | null | undefined,
): boolean {
  return false;
}

function emptyWatchSlot(): Ice3fWatchSlot {
  return { total: 0, partial: 0 };
}

function emptyWatch(): Ice3fWatchCounters {
  return Object.fromEntries(
    ICE_3F_CRITICAL_POSITIONS.map((pos) => [pos, emptyWatchSlot()]),
  ) as Ice3fWatchCounters;
}

function cloneWatch(watch: Ice3fWatchCounters): Ice3fWatchCounters {
  return Object.fromEntries(
    Object.keys(watch).map((k) => {
      const pos = Number(k);
      return [pos, { ...normalizeIce3fWatchSlot(watch[pos]) }];
    }),
  ) as Ice3fWatchCounters;
}

export function defaultIce3fMachineState(): Ice3fMachineState {
  return {
    cycle: null,
    watch: emptyWatch(),
    pendingCritical: null,
    lastSpinHead: null,
    betCommitInFlight: false,
    pendingUnitScale: 0,
    pendingGaleStreak: 0,
    pendingConsecutiveTriples: 0,
    pendingGalesSinceTriple: 0,
    entryUnits: 1,
    stakeMode: "auto",
    winsTowardEntryBump: 0,
  };
}

/** Normaliza unidades de entrada para potência de 2 entre 1 e {@link ICE_3F_MAX_ENTRY_UNITS}. */
export function ice3fNormalizeEntryUnits(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  const floored = Math.max(1, Math.floor(n));
  const pow = 2 ** Math.round(Math.log2(floored));
  return Math.min(ICE_3F_MAX_ENTRY_UNITS, Math.max(1, pow));
}

export function ice3fEntryUnitsOf(machine: Ice3fMachineState): number {
  return ice3fNormalizeEntryUnits(machine.entryUnits ?? 1);
}

export function ice3fStakeModeOf(machine: Ice3fMachineState): Ice3fStakeMode {
  return machine.stakeMode === "manual" ? "manual" : "auto";
}

/** Após vitória: conta para bump auto (63 vitórias → dobra entrada). */
export function ice3fApplyWinEntryProgress(machine: Ice3fMachineState): Ice3fMachineState {
  if (ice3fStakeModeOf(machine) !== "auto") return machine;
  const toward = Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0)) + 1;
  if (toward < ICE_3F_WINS_PER_ENTRY_BUMP) {
    return { ...machine, winsTowardEntryBump: toward };
  }
  const nextEntry = ice3fNormalizeEntryUnits(ice3fEntryUnitsOf(machine) * 2);
  return {
    ...machine,
    entryUnits: nextEntry,
    winsTowardEntryBump: 0,
  };
}

/** Gale 5 falhou em auto com entrada ≥2 → volta a 1u. */
export function ice3fApplyFinalLossEntryReset(machine: Ice3fMachineState): Ice3fMachineState {
  if (ice3fStakeModeOf(machine) !== "auto") return machine;
  if (ice3fEntryUnitsOf(machine) <= 1) {
    return { ...machine, winsTowardEntryBump: 0 };
  }
  return {
    ...machine,
    entryUnits: 1,
    winsTowardEntryBump: 0,
  };
}

/**
 * Recente = history[0]. Percorre posições 2…N à procura da ocorrência anterior.
 * Sinal = nº imediatamente à esquerda dessa ocorrência (history[i-1]).
 * Se o nº sai em sequência (history[0] === history[1], ex. 22,22), não busca
 * eco no histórico — espera o próximo número.
 */
export function ice3fFindEchoTrigger(
  historyNewestFirst: readonly number[],
): Ice3fEchoHit | null {
  if (historyNewestFirst.length < 3) return null;
  const recentNumber = historyNewestFirst[0]!;
  if (!Number.isFinite(recentNumber) || recentNumber === 0) return null;
  // Repetição consecutiva: sem eco
  if (historyNewestFirst[1] === recentNumber) return null;

  for (let i = 2; i < historyNewestFirst.length; i++) {
    if (historyNewestFirst[i] !== recentNumber) continue;
    const signalIndex = i - 1;
    const signalNumber = historyNewestFirst[signalIndex]!;
    if (!Number.isFinite(signalNumber) || signalNumber === 0) return null;
    if (!ice3fTripleForNumber(signalNumber)) return null;
    return {
      recentNumber,
      priorIndex: i,
      signalIndex,
      signalNumber,
      signalPosition: signalIndex + 1,
    };
  }
  return null;
}

export function ice3fBuildActiveFromHistory(
  historyNewestFirst: readonly number[],
  _criticalPosition?: number,
): Ice3fActive | null {
  const hit = ice3fFindEchoTrigger(historyNewestFirst);
  if (!hit) return null;
  const factors = ice3fTripleForNumber(hit.signalNumber);
  if (!factors) return null;
  const labels = factors.map(doisFatoresFactorLabel).join(" · ");
  return {
    criticalPosition: hit.signalPosition,
    factors,
    referenceNumber: hit.signalNumber,
    triggerNumber: hit.recentNumber,
    priorOccurrencePosition: hit.priorIndex + 1,
    armingDescription: `ICE 3F eco nº${hit.recentNumber}→pos${hit.priorIndex + 1} · sinal pos${hit.signalPosition} nº${hit.signalNumber} → ${labels}`,
  };
}

function evaluateBetRound(
  result: number,
  active: Ice3fActive,
): Ice3fMatchOutcome | null {
  return ice3fClassifyBetRound(result, active.referenceNumber);
}

/** @deprecated Observação por posição removida. */
export function primeIce3fWatchFromHistory(
  _historyNewestFirst: readonly number[],
): Ice3fWatchCounters {
  return emptyWatch();
}

export function tryArmCycleFromWatch(
  machine: Ice3fMachineState,
  historyNewestFirst: readonly number[],
  head: string,
  unitScale = 1,
  galeMeta?: Partial<
    Pick<Ice3fCycle, "galeStreak" | "consecutiveTriples" | "galesSinceTriple">
  >,
): Ice3fMachineState {
  if (machine.cycle) return machine;
  if (historyNewestFirst.length < ICE_3F_MIN_HISTORY) return machine;
  const active = ice3fBuildActiveFromHistory(historyNewestFirst);
  if (!active) return machine;

  const pendingScale = Math.max(0, Math.floor(machine.pendingUnitScale ?? 0));
  const entry = ice3fEntryUnitsOf(machine);
  const scale = Math.max(
    1,
    Math.floor(unitScale > 1 ? unitScale : pendingScale > 0 ? pendingScale : entry),
  );

  return {
    ...machine,
    cycle: {
      active,
      armedHead: head,
      unitScale: scale,
      galeStreak: galeMeta?.galeStreak ?? machine.pendingGaleStreak ?? 0,
      consecutiveTriples:
        galeMeta?.consecutiveTriples ?? machine.pendingConsecutiveTriples ?? 0,
      galesSinceTriple:
        galeMeta?.galesSinceTriple ?? machine.pendingGalesSinceTriple ?? 0,
      phase: "awaiting_bet",
    },
    watch: emptyWatch(),
    pendingCritical: null,
    pendingUnitScale: 0,
    pendingGaleStreak: 0,
    pendingConsecutiveTriples: 0,
    pendingGalesSinceTriple: 0,
  };
}

export function ice3fUnitScaleForCycle(cycle: Ice3fCycle): number {
  return Math.max(1, Math.floor(cycle.unitScale));
}

/**
 * Cliques em Dobrar a partir de 1 unidade (escalas 1·2·4·8…):
 * escala 1 → 0; 2 → 1; 4 → 2; 8 → 3…
 */
export function ice3fDoubleClicks(unitScale: number): number {
  const units = Math.max(1, Math.floor(unitScale));
  if (units <= 1) return 0;
  return Math.max(0, Math.round(Math.log2(units)));
}

/**
 * Após derrota: parcial (falham 2) → ×2 (+1 gale); total (falham 3 / zero) → ×4 (+2 gales).
 */
export function ice3fNextUnitScaleAfterLoss(
  currentScale: number,
  outcome: "partial_loss" | "total_loss" = "partial_loss",
): number {
  const base = Math.max(1, Math.floor(currentScale));
  return outcome === "total_loss"
    ? base * ICE_3F_TOTAL_LOSS_MULTIPLIER
    : base * ICE_3F_GALE_MULTIPLIER;
}

/** Passos de gale a somar após a derrota (1 parcial / 2 total). */
export function ice3fGaleStepsAfterLoss(
  outcome: "partial_loss" | "total_loss",
): number {
  return outcome === "total_loss" ? 2 : 1;
}

export function ice3fPadFactorPlacementMs(unitScale: number): number {
  const units = Math.max(1, Math.floor(unitScale));
  if (units >= ICE_3F_GALE3_REFERENCE_UNITS) return 0;
  return (ICE_3F_GALE3_REFERENCE_UNITS - units) * ICE_3F_CHIP_CLICK_STAGGER_MS;
}

export function ice3fBetDelayMs(_unitScale?: number): number {
  return ICE_3F_BET_DELAY_MS;
}

export function canPlaceIce3fBet(
  unitScale: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ice3fBetDelayMs(unitScale);
}

/** Marca envio de aposta em curso (CDP / automação). */
export function beginIce3fBetCommit(machine: Ice3fMachineState): Ice3fMachineState {
  if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return machine;
  return { ...machine, betCommitInFlight: true };
}

/** Confirma aposta colocada — passa a aguardar resultado para contar placar. */
export function markIce3fBetPlaced(machine: Ice3fMachineState): Ice3fMachineState {
  if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") {
    return { ...machine, betCommitInFlight: false };
  }
  return {
    ...machine,
    betCommitInFlight: false,
    cycle: { ...machine.cycle, phase: "awaiting_result" },
  };
}

export type Ice3fTickResult = {
  machine: Ice3fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice3fFlash | null;
  globalActive: Ice3fActive | null;
  globalUnitScale: number;
  missedBetWindow?: boolean;
};

export function tickIce3fPlacar(
  historyNewestFirst: readonly number[],
  machine: Ice3fMachineState,
  stats: RotatingRoomSessionStats,
): Ice3fTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Ice3fMachineState = {
    ...machine,
    lastSpinHead: head,
    watch: cloneWatch(machine.watch ?? emptyWatch()),
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: Ice3fFlash | null = null;
  let missedBetWindow = false;

  if (
    nextMachine.cycle?.phase === "awaiting_bet" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    if (nextMachine.betCommitInFlight) {
      // Aposta confirmada (extensão/automação) — promove e liquida no mesmo tick.
      nextMachine = {
        ...nextMachine,
        betCommitInFlight: false,
        cycle: { ...nextMachine.cycle, phase: "awaiting_result" },
      };
    } else {
      // Janela perdida — não conta placar; cancela indicação e espera eco novo
      // (mantém escala de gale se já havia stake > 1).
      missedBetWindow = true;
      const missedScale = ice3fUnitScaleForCycle(nextMachine.cycle);
      nextMachine = {
        ...nextMachine,
        betCommitInFlight: false,
        cycle: null,
        pendingUnitScale: Math.max(nextMachine.pendingUnitScale ?? 0, missedScale),
        pendingGaleStreak: nextMachine.cycle.galeStreak,
        pendingConsecutiveTriples: nextMachine.cycle.consecutiveTriples,
        pendingGalesSinceTriple: nextMachine.cycle.galesSinceTriple,
      };
    }
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = evaluateBetRound(resultNumber, cycle.active);

    if (outcome === "total_win" || outcome === "partial_win") {
      nextStats = recordRotatingRoomSessionWin(
        nextStats,
        cycle.galeStreak,
        ICE_3F_MAX_GALES,
      );
      statsChanged = true;
      nextMachine = ice3fApplyWinEntryProgress({
        ...nextMachine,
        cycle: null,
        watch: emptyWatch(),
        pendingCritical: null,
        betCommitInFlight: false,
        pendingUnitScale: 0,
        pendingGaleStreak: 0,
        pendingConsecutiveTriples: 0,
        pendingGalesSinceTriple: 0,
      });
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        matchOutcome: outcome,
        criticalPosition: cycle.active.criticalPosition,
        unitScale: cycle.unitScale,
        factors: cycle.active.factors,
      };
    } else if (outcome === "total_loss" || outcome === "partial_loss") {
      const failedScale = ice3fUnitScaleForCycle(cycle);
      const nextScale = ice3fNextUnitScaleAfterLoss(failedScale, outcome);
      const nextGaleStreak = cycle.galeStreak + ice3fGaleStepsAfterLoss(outcome);

      if (nextGaleStreak > ICE_3F_MAX_GALES) {
        nextStats = recordRotatingRoomSessionFinalLoss(
          nextStats,
          cycle.galeStreak,
          ICE_3F_MAX_GALES,
        );
        statsChanged = true;
        nextMachine = ice3fApplyFinalLossEntryReset({
          ...nextMachine,
          cycle: null,
          betCommitInFlight: false,
          pendingUnitScale: 0,
          pendingGaleStreak: 0,
          pendingConsecutiveTriples: 0,
          pendingGalesSinceTriple: 0,
        });
        flash = {
          resultNumber,
          won: false,
          kind: "cycle_fail",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: failedScale,
          factors: cycle.active.factors,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(
          nextStats,
          cycle.galeStreak,
          ICE_3F_MAX_GALES,
        );
        statsChanged = true;
        // Fecha ciclo e espera NOVA indicação (eco) com escala ×2 ou ×4.
        nextMachine = {
          ...nextMachine,
          cycle: null,
          betCommitInFlight: false,
          pendingUnitScale: nextScale,
          pendingGaleStreak: nextGaleStreak,
          pendingConsecutiveTriples: 0,
          pendingGalesSinceTriple: nextGaleStreak,
        };
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: nextScale,
          factors: cycle.active.factors,
        };
      }
    }
  }

  if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  if (
    !nextMachine.cycle &&
    machine.lastSpinHead == null &&
    historyNewestFirst.length >= ICE_3F_MIN_HISTORY
  ) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  // Após derrota no mesmo tick: tentar armar eco do nº resultado de imediato.
  if (!nextMachine.cycle && flash?.kind === "loss" && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
  const globalUnitScale = nextMachine.cycle
    ? ice3fUnitScaleForCycle(nextMachine.cycle)
    : Math.max(
        ice3fEntryUnitsOf(nextMachine),
        Math.floor(nextMachine.pendingUnitScale ?? 0) || 0,
      ) || ice3fEntryUnitsOf(nextMachine);

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalUnitScale,
    missedBetWindow,
  };
}

export function parseIce3fStats(raw: unknown): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, ICE_3F_MAX_GALES);
}

export function emptyIce3fStats(): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(ICE_3F_MAX_GALES);
}

export function ice3fWatchLabelForMachine(machine: Ice3fMachineState): string {
  const entry = ice3fEntryUnitsOf(machine);
  const mode = ice3fStakeModeOf(machine);
  const toward = Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0));
  if (mode === "auto") {
    return `eco → 3F · entrada ${entry}u×3 auto (${toward}/${ICE_3F_WINS_PER_ENTRY_BUMP}) · parcial×2 / total×4`;
  }
  return `eco → 3F · entrada ${entry}u×3 manual · parcial×2 / total×4 · máx. 5 gales`;
}
