/**
 * Cruzamento 2 Fatores — comparação de pares de posições (newest-first).
 *
 * **Default (ICE):** gatilho **2×4**
 * - Indica no **match** (sem exigir falhas prévias)
 * - Empate **não** conta como falha
 *
 * **KTO** (via {@link configureIce2fComparePositions}): tipicamente só **2×4** imediato.
 *
 * **Comparação:** alerta os **2 factores em comum** quando o par partilha:
 * - cor/altura, ou
 * - paridade/altura, ou
 * - cor/paridade
 * Se partilham **3** factores → prioriza **cor/altura**.
 *
 * **Indicação:** por defeito aposta nos **mesmos factores** do match
 * (ex.: match Vermelho+Par → Vermelho+Par). Alterna automaticamente
 * normal ↔ oposto ao **chegar a gale 4**, ou ao **chegar a gale 3 duas vezes
 * num intervalo de 10 giros**. Depois de alternar, só volta a mudar com a
 * mesma regra.
 * **Indicação única:** cada entrada vale só aquele match.
 * **Empate** → fecha a indicação (não reaposta os mesmos factores); espera nova
 * entrada (qualquer par elegível). Empate **não** é falha.
 * **Vitória** → fecha; martingale positivo sobe pressão (até 2). **Falha** → volta à base.
 * **Zero** na indicação = **derrota**.
 */

import {
  doisFatoresFactorLabel,
  evaluateDoisFatoresRound,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPairKind,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  factorsForNumberOnAxis,
  pairKindFromCrossingAxis,
  type CrossingAxisKind,
} from "@/lib/roulette/doisFatoresPatternCrossing";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";
import {
  umFatorOppositeFactor,
  umFatorSharedFactorsBetween,
  umFatorTriggerMatchCount,
} from "@/lib/roulette/umFatorStrategy";

export const ICE_2F_ROULETTE_TABLE_ID = 201;
export const ICE_2F_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

export type Ice2fComparePairConfig = {
  /** Ex.: `11x22`. */
  id: string;
  positions: readonly [number, number];
  /**
   * Falhas (indicações do match que **perderam**) exigidas antes de indicar neste par.
   * Empate não conta. `0` = indica no primeiro match.
   */
  requiredFailures: number;
};

function pairKey(posA: number, posB: number): string {
  return `${posA}x${posB}`;
}

function normalizePair(
  posA: number,
  posB: number,
  requiredFailures = 0,
): Ice2fComparePairConfig {
  const a = Math.max(1, Math.floor(posA));
  const b = Math.max(1, Math.floor(posB));
  return {
    id: pairKey(a, b),
    positions: [a, b],
    requiredFailures: Math.max(0, Math.floor(requiredFailures)),
  };
}

/** Default ICE: só 2×4 — indica no primeiro match. */
const ICE_2F_DEFAULT_COMPARE_PAIRS: readonly Ice2fComparePairConfig[] = [
  normalizePair(2, 4, 0),
];

/** Gatilhos activos nesta linha 2F (só 2×4). */
export const ICE_2F_KNOWN_COMPARE_PAIRS: readonly Ice2fComparePairConfig[] = [
  normalizePair(2, 4, 0),
];

export const ICE_2F_DEFAULT_ENABLED_PAIR_IDS: readonly string[] =
  ICE_2F_DEFAULT_COMPARE_PAIRS.map((p) => p.id);

export function ice2fPairLabel(pairId: string): string {
  return String(pairId ?? "").replace(/x/gi, "×");
}

/** Activa só os ids conhecidos (ordem = prioridade). Vazio → default. */
export function applyIce2fEnabledPairIds(enabledIds: readonly string[]): void {
  const known = new Map(ICE_2F_KNOWN_COMPARE_PAIRS.map((p) => [p.id, p]));
  const next: { positions: readonly [number, number]; requiredFailures: number }[] = [];
  const seen = new Set<string>();
  for (const raw of enabledIds) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    const pair = known.get(id);
    if (!pair) continue;
    seen.add(id);
    next.push({ positions: pair.positions, requiredFailures: pair.requiredFailures });
  }
  if (next.length === 0) {
    configureIce2fDefaultComparePairs();
    return;
  }
  configureIce2fComparePairs(next);
}

const ice2fCompareConfig: { pairs: Ice2fComparePairConfig[] } = {
  pairs: ICE_2F_DEFAULT_COMPARE_PAIRS.map((p) => ({ ...p, positions: [...p.positions] as [number, number] })),
};

export function getIce2fComparePairs(): readonly Ice2fComparePairConfig[] {
  return ice2fCompareConfig.pairs;
}

/** Primeiro par (compat) — ICE default 3×6. */
export function getIce2fComparePositions(): readonly [number, number] {
  const first = ice2fCompareConfig.pairs[0];
  return first?.positions ?? [2, 4];
}

export function getIce2fMinHistory(): number {
  let max = 1;
  for (const pair of ice2fCompareConfig.pairs) {
    max = Math.max(max, pair.positions[0], pair.positions[1]);
  }
  return max;
}

/** Menor profundidade entre os pares (DGA last20 cobre todos os gatilhos atuais). */
export function getIce2fSoftMinHistory(): number {
  let min = Number.POSITIVE_INFINITY;
  for (const pair of ice2fCompareConfig.pairs) {
    min = Math.min(min, Math.max(pair.positions[0], pair.positions[1]));
  }
  return Number.isFinite(min) ? min : 1;
}

function pairDepth(pair: Ice2fComparePairConfig): number {
  return Math.max(pair.positions[0], pair.positions[1]);
}

/** @deprecated Preferir {@link getIce2fComparePositions}. */
export let ICE_2F_COMPARE_POSITIONS: readonly [number, number] = getIce2fComparePositions();
/** @deprecated Preferir {@link getIce2fComparePairs}. */
export let ICE_2F_CRITICAL_POSITIONS: readonly [number, number] = getIce2fComparePositions();
export const ICE_2F_CROSSING_AXES = [
  "cor-altura",
  "altura-paridade",
  "cor-paridade",
] as const;

/** Precisa da posição mais profunda entre todos os pares. */
export let ICE_2F_MIN_HISTORY = getIce2fMinHistory();
/** @deprecated Janela de eco removida — gatilho é o par configurado. */
export const ICE_2F_SCAN_WINDOW = 11;
export const ICE_2F_MAX_RECOVERY = 8;

function syncDeprecatedPositionExports(): void {
  ICE_2F_COMPARE_POSITIONS = getIce2fComparePositions();
  ICE_2F_CRITICAL_POSITIONS = getIce2fComparePositions();
  ICE_2F_MIN_HISTORY = getIce2fMinHistory();
}

/**
 * Substitui a lista de pares (ex.: ICE default com falhas).
 * Actualiza também {@link ICE_2F_MIN_HISTORY}.
 */
export function configureIce2fComparePairs(
  pairs: readonly { positions: readonly [number, number]; requiredFailures?: number }[],
): void {
  const next: Ice2fComparePairConfig[] = [];
  for (const raw of pairs) {
    const [a, b] = raw.positions;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    next.push(normalizePair(a, b, raw.requiredFailures ?? 0));
  }
  ice2fCompareConfig.pairs =
    next.length > 0
      ? next
      : ICE_2F_DEFAULT_COMPARE_PAIRS.map((p) => ({
          ...p,
          positions: [...p.positions] as [number, number],
        }));
  syncDeprecatedPositionExports();
}

/** Restaura os pares default ICE (indicação imediata no match). */
export function configureIce2fDefaultComparePairs(): void {
  configureIce2fComparePairs(ICE_2F_DEFAULT_COMPARE_PAIRS);
}

/**
 * Define um único par imediato (ex.: KTO usa 2 e 4).
 * Actualiza também {@link ICE_2F_MIN_HISTORY}.
 */
export function configureIce2fComparePositions(posA: number, posB: number): void {
  configureIce2fComparePairs([{ positions: [posA, posB], requiredFailures: 0 }]);
}

/** Limiar legado (pares com falhas usam o valor por par). */
export const ICE_2F_REQUIRED_FAILURES = 0;
export const ICE_2F_RELAXED_REQUIRED_FAILURES = 0;
export const ICE_2F_RELAXED_FALLBACK_FAILURES = 0;
export const ICE_2F_INACTIVE_SPINS_FOR_RELAX = 0;

/** Esperas de clique: entrada, gale e reentrada pós-empate — todas 6s após o giro. */
export const ICE_2F_RECOVERY_BET_DELAY_MS = 6_000;
export const ICE_2F_IMMEDIATE_REBET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
export const ICE_2F_FIRST_BET_SETTLE_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
export const ICE_2F_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;

/** Entrada + 8 gales: 1 · 1 · 2 · 4 · 8 · 16 · 32 · 64 · 128. */
export const ICE_2F_STAKE_UNITS = [1, 1, 2, 4, 8, 16, 32, 64, 128] as const;
export const ICE_2F_GALE3_REFERENCE_UNITS = 8;

/** clássico = sobe no L; positive = sobe no W e reset no L (tecto pressão 2). */
export type Ice2fStakeMode = "martingale" | "positive";
/** Tecto do martingale positivo: entrada + pressão 1·2. */
export const ICE_2F_POSITIVE_MAX_RECOVERY = 2;

/** Oposto = invertido do match; normal = mesmos factores do match. */
export type Ice2fIndicationPolarity = "opposite" | "normal";
/** Alterna polaridade ao entrar neste gale. */
export const ICE_2F_POLARITY_FLIP_GALE = 4;
/** Alterna polaridade se este gale ocorrer 2× na janela. */
export const ICE_2F_POLARITY_GALE3 = 3;
/** Janela (giros) para contar 2× gale 3. */
export const ICE_2F_POLARITY_GALE3_WINDOW_SPINS = 10;

export function normalizeIce2fIndicationPolarity(
  value: unknown,
): Ice2fIndicationPolarity {
  return value === "opposite" ? "opposite" : "normal";
}

export function ice2fToggleIndicationPolarity(
  polarity: Ice2fIndicationPolarity,
): Ice2fIndicationPolarity {
  return polarity === "opposite" ? "normal" : "opposite";
}

export function ice2fPadFactorPlacementMs(_units: number): number {
  return 0;
}

/** Posição 1-based no histórico (1 = mais recente). */
export type Ice2fCriticalPosition = number;
export type Ice2fCrossingAxis = (typeof ICE_2F_CROSSING_AXES)[number];

export type Ice2fWatchSlot = { failures: number };
/** Contadores de falha por id de par (`11x22`, `2x4`, …). */
export type Ice2fWatchCounters = Record<string, Ice2fWatchSlot>;
/** @deprecated Eixos por posição — watch actual é por par. */
export type Ice2fWatchAxisMap = Record<Ice2fCrossingAxis, Ice2fWatchSlot>;

export type Ice2fActive = {
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  pairKind: DoisFatoresPairKind;
  referenceNumber: number;
  armingDescription: string;
  /** Posição mais profunda do par. */
  matchPosition?: number;
  matchNumber?: number;
  /** Número na posição mais recente do par. */
  triggerNumber?: number;
  /** Id do par que armou (`11x22`, `2x4`, …). */
  pairId?: string;
};

export type Ice2fCyclePhase = "awaiting_bet" | "awaiting_result" | "awaiting_reference";

export type Ice2fCycle = {
  active: Ice2fActive;
  armedHead: string;
  recovery: number;
  phase: Ice2fCyclePhase;
  relaxedEntry?: boolean;
  immediateBet?: boolean;
};

export type Ice2fMachineState = {
  cycle: Ice2fCycle | null;
  /** Stub para UI/compat. */
  watch: Ice2fWatchCounters;
  pendingArm: { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } | null;
  lastSpinHead: string | null;
  betCommitInFlight?: boolean;
  betCommitArmedHead?: string | null;
  inactiveSpinsWithoutEntry?: number;
  /** Preferência de eixo (legado); o gatilho 11/22 define o eixo pelo match. */
  nextEntryAxis: Ice2fCrossingAxis;
  /** @deprecated Gatilho fixo 11/22 — mantido por persistência. */
  lockedPosition: Ice2fCriticalPosition | null;
  /** Gale a aplicar na próxima armação se a derrota não encontrou match de imediato. */
  pendingRecovery: number;
  /** Após janela perdida — próxima armação aposta sem esperar o delay cheio. */
  forceImmediateBet?: boolean;
  /** Último par que armou (UI); os pares são monitorados em paralelo. */
  gatePairId?: string | null;
  /**
   * Observações virtuais por par (sem apostar) — conta falha se a indicação virtual perder.
   */
  pendingMatchObservations?: Record<
    string,
    { hit: Ice2fCriticalHit; observationHead: string }
  >;
  /** @deprecated Usar {@link pendingMatchObservations}. */
  pendingMatchObservation?: {
    pairId: string;
    hit: Ice2fCriticalHit;
    observationHead: string;
  } | null;
  /**
   * Indicação acabada de liquidar — não rearma a mesma chave
   * (factores + números do par) enquanto o match for o mesmo fantasma.
   */
  lastClosedIndicationKey?: string | null;
  /** Contador monotónico de giros (sobe em cada head novo). */
  spinIndex?: number;
  /** normal (default) ou opposite — alterna por gale 4 / gale 3×2. */
  indicationPolarity?: Ice2fIndicationPolarity;
  /** Índices de giro em que se entrou em gale 3 (janela de 10). */
  gale3SpinIndexes?: number[];
  /** Último motivo de alternância de polaridade (UI). */
  lastPolarityFlipReason?: "gale4" | "gale3x2" | null;
  zeroDebtUnits?: number;
  zeroRecoveredUnits?: number;
  zeroShift?: number;
  zeroRecoveryArmed?: boolean;
};

export type Ice2fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "tie" | "zero";
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  recovery: number;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
};

export type Ice2fCriticalHit = {
  criticalPosition: Ice2fCriticalPosition;
  matchPosition: number;
  matchNumber: number;
  triggerNumber: number;
  axis: Ice2fCrossingAxis;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  sharedCount: 2 | 3;
  pairId: string;
  requiredFailures: number;
};

function emptyWatchSlot(): Ice2fWatchSlot {
  return { failures: 0 };
}

export function emptyWatch(): Ice2fWatchCounters {
  const w: Ice2fWatchCounters = {};
  for (const pair of getIce2fComparePairs()) w[pair.id] = emptyWatchSlot();
  return w;
}

function cloneWatch(watch: Ice2fWatchCounters): Ice2fWatchCounters {
  const next: Ice2fWatchCounters = emptyWatch();
  for (const pair of getIce2fComparePairs()) {
    const raw = watch[pair.id];
    if (raw && typeof raw.failures === "number" && Number.isFinite(raw.failures)) {
      next[pair.id] = { failures: Math.max(0, Math.floor(raw.failures)) };
    }
  }
  return next;
}

export function defaultIce2fMachineState(): Ice2fMachineState {
  const firstPair = getIce2fComparePairs()[0];
  return {
    cycle: null,
    watch: emptyWatch(),
    pendingArm: null,
    lastSpinHead: null,
    betCommitInFlight: false,
    betCommitArmedHead: null,
    inactiveSpinsWithoutEntry: 0,
    nextEntryAxis: "cor-altura",
    lockedPosition: null,
    pendingRecovery: 0,
    gatePairId: firstPair?.id ?? null,
    forceImmediateBet: false,
    pendingMatchObservations: {},
    pendingMatchObservation: null,
    lastClosedIndicationKey: null,
    spinIndex: 0,
    indicationPolarity: "normal",
    gale3SpinIndexes: [],
    lastPolarityFlipReason: null,
    zeroDebtUnits: 0,
    zeroRecoveredUnits: 0,
    zeroShift: 0,
    zeroRecoveryArmed: false,
  };
}

/**
 * Ao entrar em gale 4 → alterna polaridade.
 * Ao entrar em gale 3 pela 2ª vez em ≤10 giros → alterna e limpa a janela.
 */
export function ice2fApplyPolarityRulesOnRecovery(
  machine: Ice2fMachineState,
  nextRecovery: number,
  spinIndex: number,
): Ice2fMachineState {
  const recovery = Math.max(0, Math.floor(nextRecovery));
  const idx = Math.max(0, Math.floor(spinIndex));
  let polarity = normalizeIce2fIndicationPolarity(machine.indicationPolarity);
  let gale3 = Array.isArray(machine.gale3SpinIndexes)
    ? machine.gale3SpinIndexes
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 0)
    : [];
  let flipReason: Ice2fMachineState["lastPolarityFlipReason"] =
    machine.lastPolarityFlipReason ?? null;

  if (recovery === ICE_2F_POLARITY_FLIP_GALE) {
    polarity = ice2fToggleIndicationPolarity(polarity);
    gale3 = [];
    flipReason = "gale4";
  } else if (recovery === ICE_2F_POLARITY_GALE3) {
    gale3 = [...gale3, idx].filter(
      (n) => idx - n <= ICE_2F_POLARITY_GALE3_WINDOW_SPINS,
    );
    // Evita duplicar o mesmo giro.
    gale3 = [...new Set(gale3)].sort((a, b) => a - b);
    if (gale3.length >= 2) {
      polarity = ice2fToggleIndicationPolarity(polarity);
      gale3 = [];
      flipReason = "gale3x2";
    }
  }

  return {
    ...machine,
    indicationPolarity: polarity,
    gale3SpinIndexes: gale3,
    lastPolarityFlipReason: flipReason,
  };
}

function getActiveGatePair(machine: Ice2fMachineState): Ice2fComparePairConfig | null {
  const pairs = getIce2fComparePairs();
  if (pairs.length === 0) return null;
  const id = machine.gatePairId ?? pairs[0]!.id;
  return pairs.find((p) => p.id === id) ?? pairs[0]!;
}

function nextGatePairId(currentId: string | null | undefined): string | null {
  const pairs = getIce2fComparePairs();
  if (pairs.length === 0) return null;
  const idx = pairs.findIndex((p) => p.id === currentId);
  const next = pairs[(idx >= 0 ? idx + 1 : 0) % pairs.length]!;
  return next.id;
}

function emptyPendingObservations(): Record<
  string,
  { hit: Ice2fCriticalHit; observationHead: string }
> {
  return {};
}

function clonePendingObservations(
  raw: Ice2fMachineState["pendingMatchObservations"] | null | undefined,
  legacy?: Ice2fMachineState["pendingMatchObservation"],
): Record<string, { hit: Ice2fCriticalHit; observationHead: string }> {
  const next = emptyPendingObservations();
  if (raw && typeof raw === "object") {
    for (const [id, obs] of Object.entries(raw)) {
      if (obs?.hit && typeof obs.observationHead === "string") {
        next[id] = { hit: obs.hit, observationHead: obs.observationHead };
      }
    }
  }
  if (legacy?.pairId && legacy.hit) {
    next[legacy.pairId] = {
      hit: legacy.hit,
      observationHead: legacy.observationHead,
    };
  }
  return next;
}

function getPairConfigById(pairId: string): Ice2fComparePairConfig | undefined {
  return getIce2fComparePairs().find((p) => p.id === pairId);
}

function recordPairIndicationFailure(
  watch: Ice2fWatchCounters,
  pairId: string,
): Ice2fWatchCounters {
  const next = cloneWatch(watch);
  const prev = next[pairId]?.failures ?? 0;
  next[pairId] = { failures: prev + 1 };
  return next;
}

function clearPairFailures(
  watch: Ice2fWatchCounters,
  pairId: string,
): Ice2fWatchCounters {
  const next = cloneWatch(watch);
  next[pairId] = { failures: 0 };
  return next;
}

/** Resolve todas as observações pendentes: só derrota conta falha; vitória zera; empate neutro. */
function resolvePendingMatchObservations(
  machine: Ice2fMachineState,
  resultNumber: number,
): Ice2fMachineState {
  const pending = clonePendingObservations(
    machine.pendingMatchObservations,
    machine.pendingMatchObservation,
  );
  const ids = Object.keys(pending);
  if (ids.length === 0) {
    return {
      ...machine,
      pendingMatchObservations: {},
      pendingMatchObservation: null,
    };
  }

  let watch = machine.watch ?? emptyWatch();
  const polarity = normalizeIce2fIndicationPolarity(machine.indicationPolarity);
  for (const pairId of ids) {
    const obs = pending[pairId]!;
    const active = ice2fBuildActiveFromHit(obs.hit, polarity);
    const outcome = ice2fClassifyBetRound(resultNumber, active);
    if (outcome === "W") {
      watch = clearPairFailures(watch, pairId);
    } else if (outcome === "L") {
      watch = recordPairIndicationFailure(watch, pairId);
    }
  }

  return {
    ...machine,
    watch,
    pendingMatchObservations: {},
    pendingMatchObservation: null,
  };
}

/** Resolve observação pendente legada (um par). */
function resolvePendingMatchObservation(
  machine: Ice2fMachineState,
  resultNumber: number,
): Ice2fMachineState {
  return resolvePendingMatchObservations(machine, resultNumber);
}

/** Regista falha/vitória de indicação real. Empate não altera o contador. */
function applyPairIndicationOutcome(
  machine: Ice2fMachineState,
  pairId: string | undefined,
  outcome: "W" | "L" | "continue",
): Ice2fMachineState {
  if (!pairId) return machine;
  const pair = getPairConfigById(pairId);
  if (!pair || pair.requiredFailures <= 0) return machine;
  if (outcome === "continue") {
    return machine;
  }

  let watch = machine.watch ?? emptyWatch();
  if (outcome === "W") {
    watch = clearPairFailures(watch, pairId);
  } else {
    watch = recordPairIndicationFailure(watch, pairId);
  }
  return { ...machine, watch };
}

export function ice2fArmingThresholds(_machine: Ice2fMachineState): number[] {
  return [0];
}

export function ice2fRequiredFailuresForArming(_machine: Ice2fMachineState): number {
  return 0;
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function axisLabelPt(axis: Ice2fCrossingAxis): string {
  if (axis === "cor-altura") return "cor/altura";
  if (axis === "altura-paridade") return "paridade/altura";
  return "cor/paridade";
}

function axisShort(axis: Ice2fCrossingAxis): string {
  if (axis === "cor-altura") return "c/a";
  if (axis === "altura-paridade") return "p/a";
  return "c/p";
}

function pairKindFromFactors(
  f1: DoisFatoresFactor,
  f2: DoisFatoresFactor,
): Ice2fCrossingAxis {
  const kinds = new Set([f1.kind, f2.kind]);
  if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
  if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
  return "altura-paridade";
}

export function ice2fToggleAxis(axis: Ice2fCrossingAxis): Ice2fCrossingAxis {
  if (axis === "cor-altura") return "altura-paridade";
  if (axis === "altura-paridade") return "cor-paridade";
  return "cor-altura";
}

/**
 * Compara duas posições: 2 factores em comum → eixo correspondente;
 * 3 factores → prioriza cor/altura.
 */
export function ice2fFindHitForPair(
  historyNewestFirst: readonly number[],
  posA: number,
  posB: number,
  pairMeta?: { id?: string; requiredFailures?: number },
): Ice2fCriticalHit | null {
  const depth = Math.max(posA, posB);
  if (historyNewestFirst.length < depth) return null;
  const numberA = historyNewestFirst[posA - 1]!;
  const numberB = historyNewestFirst[posB - 1]!;
  if (!Number.isFinite(numberA) || !Number.isFinite(numberB)) return null;
  if (numberA === 0 || numberB === 0) return null;

  const sharedCount = umFatorTriggerMatchCount(numberA, numberB);
  if (sharedCount < 2) return null;

  let axis: Ice2fCrossingAxis;
  let factor1: DoisFatoresFactor;
  let factor2: DoisFatoresFactor;

  if (sharedCount >= 3) {
    axis = "cor-altura";
    const factors = factorsForNumberOnAxis(numberA, axis);
    if (!factors) return null;
    factor1 = factors[0];
    factor2 = factors[1];
  } else {
    const shared = umFatorSharedFactorsBetween(numberA, numberB);
    if (shared.length !== 2) return null;
    factor1 = shared[0]!;
    factor2 = shared[1]!;
    axis = pairKindFromFactors(factor1, factor2);
  }

  return {
    criticalPosition: posA,
    matchPosition: posB,
    matchNumber: numberB,
    triggerNumber: numberA,
    axis,
    factor1,
    factor2,
    sharedCount: sharedCount >= 3 ? 3 : 2,
    pairId: pairMeta?.id ?? pairKey(posA, posB),
    requiredFailures: pairMeta?.requiredFailures ?? 0,
  };
}

/**
 * Primeiro match entre os pares configurados (sem limiar de falhas).
 * Para armar com falhas use {@link tryArmCycleFromWatch}.
 */
export function ice2fFindCriticalPosition(
  historyNewestFirst: readonly number[],
): Ice2fCriticalHit | null {
  if (historyNewestFirst.length < getIce2fMinHistory()) return null;
  for (const pair of getIce2fComparePairs()) {
    const hit = ice2fFindHitForPair(
      historyNewestFirst,
      pair.positions[0],
      pair.positions[1],
      { id: pair.id, requiredFailures: pair.requiredFailures },
    );
    if (hit) return hit;
  }
  return null;
}

export function ice2fToTapeteActive(active: Ice2fActive): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: active.axis,
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.referenceNumber,
    factor1: active.factor1,
    factor2: active.factor2,
    triggerNumbers: [
      active.referenceNumber,
      active.matchNumber ?? active.referenceNumber,
    ] as const,
    armingDescription: active.armingDescription,
  };
}

/** @deprecated Use {@link ice2fToTapeteActive} */
const toTapeteActive = ice2fToTapeteActive;

export function ice2fClassifyBetRound(
  result: number,
  active: Ice2fActive,
): "W" | "L" | "continue" | "zero" {
  if (result === 0) return "L";
  return evaluateDoisFatoresRound(result, toTapeteActive(active));
}

export function ice2fIsWatchSlotArmed(
  slot: Ice2fWatchSlot,
  requiredFailures: number = ICE_2F_REQUIRED_FAILURES,
): boolean {
  return slot.failures >= requiredFailures;
}

export function ice2fOppositeBetFactors(
  factors: readonly [DoisFatoresFactor, DoisFatoresFactor],
): [DoisFatoresFactor, DoisFatoresFactor] {
  return [umFatorOppositeFactor(factors[0]), umFatorOppositeFactor(factors[1])];
}

export function ice2fBuildActiveFromHit(
  hit: Ice2fCriticalHit,
  polarity: Ice2fIndicationPolarity = "normal",
): Ice2fActive {
  const mode = normalizeIce2fIndicationPolarity(polarity);
  const [factor1, factor2] =
    mode === "opposite"
      ? ice2fOppositeBetFactors([hit.factor1, hit.factor2])
      : [hit.factor1, hit.factor2];
  const matchLabels = [hit.factor1, hit.factor2]
    .map((f) => doisFatoresFactorLabel(f))
    .join(" · ");
  const labels = [factor1, factor2]
    .map((f) => doisFatoresFactorLabel(f))
    .join(" · ");
  const tripleHint = hit.sharedCount === 3 ? " · 3F→cor/altura" : "";
  const failHint =
    hit.requiredFailures > 0
      ? ` · após ${hit.requiredFailures} falhas de indicação`
      : "";
  const polarityHint = mode === "opposite" ? " → oposto " : " → normal ";
  const posLabel = `pos${hit.criticalPosition}/${hit.matchPosition}`;
  return {
    criticalPosition: hit.criticalPosition,
    axis: hit.axis,
    factor1,
    factor2,
    pairKind: pairKindFromCrossingAxis(hit.axis as CrossingAxisKind),
    referenceNumber: hit.triggerNumber,
    armingDescription: `2F ${posLabel} ${axisLabelPt(hit.axis)}: nº${hit.triggerNumber}·${hit.matchNumber} match ${matchLabels}${polarityHint}${labels}${tripleHint}${failHint}`,
    matchPosition: hit.matchPosition,
    matchNumber: hit.matchNumber,
    triggerNumber: hit.triggerNumber,
    pairId: hit.pairId,
  };
}

export function ice2fBuildActiveFromHistory(
  historyNewestFirst: readonly number[],
  _position?: Ice2fCriticalPosition,
  _axis?: Ice2fCrossingAxis,
  _meta?: Partial<Pick<Ice2fActive, "matchPosition" | "matchNumber" | "triggerNumber">>,
): Ice2fActive | null {
  // Só arma com match real do par configurado (≥2 factores em comum). Nunca inventar
  // factores a partir de um único número (ex.: 35 Preto/Alto sem o 10 partilhar).
  const hit = ice2fFindCriticalPosition(historyNewestFirst);
  if (!hit) return null;
  return ice2fBuildActiveFromHit(hit);
}

export function primeIce2fWatchFromHistory(
  historyNewestFirst: readonly number[],
): Ice2fWatchCounters {
  let watch = emptyWatch();
  const softMin = getIce2fSoftMinHistory();
  if (historyNewestFirst.length < softMin) return watch;

  const chronological = [...historyNewestFirst].reverse();
  const pendingByPair = new Map<string, Ice2fCriticalHit>();

  for (let end = softMin; end <= chronological.length; end++) {
    const sliceNewestFirst = chronological.slice(0, end).reverse();
    const resultNumber = chronological[end - 1]!;

    for (const pair of getIce2fComparePairs()) {
      if (sliceNewestFirst.length < pairDepth(pair)) continue;

      const pending = pendingByPair.get(pair.id);
      if (pending) {
        const active = ice2fBuildActiveFromHit(pending);
        const outcome = ice2fClassifyBetRound(resultNumber, active);
        if (outcome === "W") watch = clearPairFailures(watch, pair.id);
        else if (outcome === "L") watch = recordPairIndicationFailure(watch, pair.id);
        pendingByPair.delete(pair.id);
      }

      const failures = watch[pair.id]?.failures ?? 0;
      if (failures >= pair.requiredFailures && pair.requiredFailures > 0) continue;

      const hit = ice2fFindHitForPair(
        sliceNewestFirst,
        pair.positions[0],
        pair.positions[1],
        { id: pair.id, requiredFailures: pair.requiredFailures },
      );
      if (hit) pendingByPair.set(pair.id, hit);
    }
  }

  return watch;
}

export function ice2fNextCriticalSlot(
  position: Ice2fCriticalPosition,
  axis: Ice2fCrossingAxis,
): { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } {
  return { position, axis: ice2fToggleAxis(axis) };
}

function ice2fClearCycleKeepGale(
  machine: Ice2fMachineState,
  recoveryToKeep: number,
): Ice2fMachineState {
  return {
    ...machine,
    cycle: null,
    betCommitInFlight: false,
    betCommitArmedHead: null,
    lockedPosition: null,
    pendingRecovery: Math.max(0, Math.floor(recoveryToKeep)),
  };
}

/** Após W/L: regista último par (UI); monitorização continua em paralelo. */
function advanceGateAfterWinOrLoss(
  machine: Ice2fMachineState,
  fromPairId: string | undefined,
): Ice2fMachineState {
  return {
    ...machine,
    gatePairId: fromPairId ?? machine.gatePairId ?? null,
    lockedPosition: null,
  };
}

/** Empate: fecha indicação; não muda falhas; gale mantido. */
function insistGateAfterTie(
  machine: Ice2fMachineState,
  pairId: string | undefined,
  recoveryToKeep: number,
): Ice2fMachineState {
  return {
    ...ice2fClearCycleKeepGale(machine, recoveryToKeep),
    gatePairId: pairId ?? machine.gatePairId ?? null,
  };
}

function armCycleFromHit(
  machine: Ice2fMachineState,
  head: string,
  hit: Ice2fCriticalHit,
  recovery: number,
): Ice2fMachineState {
  const polarity = normalizeIce2fIndicationPolarity(machine.indicationPolarity);
  const active = ice2fBuildActiveFromHit(hit, polarity);
  const immediate =
    recovery > 0 || machine.forceImmediateBet === true;
  const pending = clonePendingObservations(
    machine.pendingMatchObservations,
    machine.pendingMatchObservation,
  );
  delete pending[hit.pairId];
  return {
    ...machine,
    lockedPosition: hit.criticalPosition,
    nextEntryAxis: hit.axis,
    inactiveSpinsWithoutEntry: 0,
    pendingArm: null,
    pendingRecovery: 0,
    forceImmediateBet: false,
    gatePairId: hit.pairId,
    pendingMatchObservations: pending,
    pendingMatchObservation: null,
    cycle: {
      active,
      armedHead: head,
      recovery,
      phase: "awaiting_bet",
      immediateBet: immediate,
    },
  };
}

function indicationKeyFromActive(active: {
  pairId?: string;
  axis: Ice2fCrossingAxis;
  factor1: { kind: string; value: string };
  factor2: { kind: string; value: string };
  triggerNumber?: number;
  matchNumber?: number;
}): string {
  return [
    active.pairId ?? "",
    active.axis,
    active.factor1.kind,
    active.factor1.value,
    active.factor2.kind,
    active.factor2.value,
    active.triggerNumber ?? "",
    active.matchNumber ?? "",
  ].join("|");
}

function indicationKeyFromHit(hit: Ice2fCriticalHit): string {
  return indicationKeyFromActive({
    pairId: hit.pairId,
    axis: hit.axis,
    factor1: hit.factor1,
    factor2: hit.factor2,
    triggerNumber: hit.triggerNumber,
    matchNumber: hit.matchNumber,
  });
}

/**
 * Monitoriza **todos** os pares em paralelo.
 * Arma no primeiro (ordem da lista) com match (e falhas ≥ limiar, se > 0).
 */
export function tryArmCycleFromWatch(
  machine: Ice2fMachineState,
  historyNewestFirst: readonly number[],
  head: string,
): Ice2fMachineState {
  if (machine.cycle) return machine;
  if (historyNewestFirst.length < getIce2fSoftMinHistory()) return machine;

  const pendingRecovery = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
  const watch = machine.watch ?? emptyWatch();
  const pending = clonePendingObservations(
    machine.pendingMatchObservations,
    machine.pendingMatchObservation,
  );
  const closedKey = machine.lastClosedIndicationKey ?? null;

  let armHit: Ice2fCriticalHit | null = null;

  for (const pair of getIce2fComparePairs()) {
    if (historyNewestFirst.length < pairDepth(pair)) continue;

    const hit = ice2fFindHitForPair(
      historyNewestFirst,
      pair.positions[0],
      pair.positions[1],
      { id: pair.id, requiredFailures: pair.requiredFailures },
    );

    if (!hit) {
      delete pending[pair.id];
      continue;
    }

    // Mesmo match/factores acabados de liquidar → não reabrir (fantasma).
    if (closedKey && indicationKeyFromHit(hit) === closedKey) {
      continue;
    }

    const failures = watch[pair.id]?.failures ?? 0;
    if (pair.requiredFailures <= 0 || failures >= pair.requiredFailures) {
      if (!armHit) armHit = hit;
      delete pending[pair.id];
    } else {
      pending[pair.id] = { hit, observationHead: head };
    }
  }

  if (armHit) {
    return armCycleFromHit(
      {
        ...machine,
        watch,
        pendingMatchObservations: pending,
        pendingMatchObservation: null,
        betCommitInFlight: false,
        lastClosedIndicationKey: null,
      },
      head,
      armHit,
      pendingRecovery,
    );
  }

  return {
    ...machine,
    watch,
    pendingMatchObservations: pending,
    pendingMatchObservation: null,
    betCommitInFlight: false,
  };
}

/**
 * Após derrota: guarda gale e espera o **próximo giro** para nova indicação
 * (uma indicação por giro — não rearma no mesmo head).
 */
function armAfterLoss(
  machine: Ice2fMachineState,
  _historyNewestFirst: readonly number[],
  _head: string,
  nextRecovery: number,
  _previousAxis: Ice2fCrossingAxis,
): Ice2fMachineState {
  return {
    ...machine,
    lockedPosition: null,
    pendingRecovery: nextRecovery,
    cycle: null,
    betCommitInFlight: false,
  };
}

export function ice2fStakeUnits(recovery: number, zeroShift = 0): number {
  const idx = Math.min(
    Math.max(0, Math.floor(recovery)),
    ICE_2F_STAKE_UNITS.length - 1,
  );
  const shift = Math.max(0, Math.floor(zeroShift));
  return ICE_2F_STAKE_UNITS[idx]! * 2 ** shift;
}

export function ice2fDoubleClicks(recovery: number, zeroShift = 0): number {
  const units = ice2fStakeUnits(recovery, 0);
  const base = units <= 1 ? 0 : Math.round(Math.log2(units));
  return base + Math.max(0, Math.floor(zeroShift));
}

export function ice2fZeroDebtForRecovery(recovery: number, zeroShift = 0): number {
  const r = Math.max(0, Math.floor(recovery));
  let sum = 0;
  for (let i = 0; i < r; i++) sum += ice2fStakeUnits(i, zeroShift);
  return sum;
}

export function ice2fEffectiveZeroShift(machine: Ice2fMachineState): number {
  const debt = machine.zeroDebtUnits ?? 0;
  if (debt <= 0) return 0;
  if (!machine.zeroRecoveryArmed) return 0;
  return Math.max(0, Math.floor(machine.zeroShift ?? 0));
}

function clearZeroRecovery(machine: Ice2fMachineState): Ice2fMachineState {
  return {
    ...machine,
    zeroDebtUnits: 0,
    zeroRecoveredUnits: 0,
    zeroShift: 0,
    zeroRecoveryArmed: false,
  };
}

function applyWinZeroRecoveryAccounting(
  machine: Ice2fMachineState,
  wonUnits: number,
): Ice2fMachineState {
  const debt = machine.zeroDebtUnits ?? 0;
  if (debt <= 0) return clearZeroRecovery(machine);
  if (!machine.zeroRecoveryArmed) {
    return {
      ...machine,
      zeroRecoveryArmed: true,
      zeroRecoveredUnits: 0,
    };
  }
  const recovered = (machine.zeroRecoveredUnits ?? 0) + Math.max(0, wonUnits);
  if (recovered >= debt) return clearZeroRecovery(machine);
  return {
    ...machine,
    zeroRecoveredUnits: recovered,
    zeroRecoveryArmed: true,
  };
}

export function ice2fRecoveryAfterWin(
  recovery: number,
  stakeMode: Ice2fStakeMode = "martingale",
  maxRecovery: number = ICE_2F_MAX_RECOVERY,
): number {
  const r = Math.max(0, Math.floor(recovery));
  if (stakeMode === "positive") {
    const cap = Math.min(
      ICE_2F_POSITIVE_MAX_RECOVERY,
      Math.max(0, Math.floor(maxRecovery)),
    );
    return Math.min(cap, r + 1);
  }
  return 0;
}

export function ice2fRecoveryAfterLoss(
  recovery: number,
  stakeMode: Ice2fStakeMode = "martingale",
): number {
  if (stakeMode === "positive") {
    return 0;
  }
  return Math.max(0, Math.floor(recovery)) + 1;
}

export function ice2fEffectiveMaxRecovery(
  maxRecovery: number,
  stakeMode: Ice2fStakeMode = "martingale",
): number {
  const cap = Math.max(0, Math.floor(maxRecovery));
  if (stakeMode === "positive") {
    return Math.min(ICE_2F_POSITIVE_MAX_RECOVERY, cap);
  }
  return cap;
}

export function normalizeIce2fStakeMode(raw: unknown): Ice2fStakeMode {
  return raw === "positive" ? "positive" : "martingale";
}

export function ice2fBetDelayMs(_recovery?: number, immediateBet?: boolean): number {
  return immediateBet === true
    ? ICE_2F_IMMEDIATE_REBET_DELAY_MS
    : ICE_2F_RECOVERY_BET_DELAY_MS;
}

export function ice2fBetDelayUntilMs(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  immediateBet?: boolean,
): number | null {
  const delayMs = ice2fBetDelayMs(recovery, immediateBet);
  return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs)
    ? lastSpinAtMs + delayMs
    : null;
}

export function canPlaceIce2fBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
  immediateBet?: boolean,
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ice2fBetDelayMs(recovery, immediateBet);
}

export type Ice2fTickResult = {
  machine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice2fFlash | null;
  globalActive: Ice2fActive | null;
  globalRecovery: number;
  /** Giro novo chegou antes de a aposta ser confirmada — não conta W/L. */
  missedBetWindow?: boolean;
};

export function tickIce2fPlacar(
  historyNewestFirst: readonly number[],
  machine: Ice2fMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ICE_2F_MAX_RECOVERY,
  stakeMode: Ice2fStakeMode = "martingale",
): Ice2fTickResult {
  const effectiveMax = ice2fEffectiveMaxRecovery(maxRecovery, stakeMode);
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Ice2fMachineState = {
    ...machine,
    lastSpinHead: head,
    watch: cloneWatch(machine.watch ?? emptyWatch()),
    nextEntryAxis: machine.nextEntryAxis ?? "cor-altura",
    lockedPosition: machine.lockedPosition ?? null,
    pendingRecovery: machine.pendingRecovery ?? 0,
    spinIndex: Math.max(0, Math.floor(machine.spinIndex ?? 0)),
    indicationPolarity: normalizeIce2fIndicationPolarity(machine.indicationPolarity),
    gale3SpinIndexes: Array.isArray(machine.gale3SpinIndexes)
      ? [...machine.gale3SpinIndexes]
      : [],
    lastPolarityFlipReason: machine.lastPolarityFlipReason ?? null,
    pendingMatchObservations: clonePendingObservations(
      machine.pendingMatchObservations,
      machine.pendingMatchObservation,
    ),
    pendingMatchObservation: null,
  };
  if (headChanged) {
    nextMachine = {
      ...nextMachine,
      spinIndex: (nextMachine.spinIndex ?? 0) + 1,
    };
  }
  const spinIndex = nextMachine.spinIndex ?? 0;
  let nextStats = stats;
  let statsChanged = false;
  let flash: Ice2fFlash | null = null;
  let missedBetWindow = false;
  let justResolvedResult = false;

  if (
    headChanged &&
    Object.keys(nextMachine.pendingMatchObservations ?? {}).length > 0
  ) {
    nextMachine = resolvePendingMatchObservations(
      nextMachine,
      historyNewestFirst[0]!,
    );
  }

  if (
    nextMachine.cycle?.phase === "awaiting_bet" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    // Indicação única: novo giro sem aposta → cancela; gale fica para o próximo match.
    // Próxima armação aposta já (forceImmediateBet) para não perder a janela outra vez.
    missedBetWindow = true;
    nextMachine = {
      ...ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery),
      forceImmediateBet: true,
    };
  }

  if (
    nextMachine.cycle?.phase === "awaiting_reference" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    nextMachine = ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = ice2fClassifyBetRound(resultNumber, cycle.active);
    const { active, recovery } = cycle;
    const closedKey = indicationKeyFromActive(active);
    justResolvedResult = true;

    if (outcome === "W") {
      const wonUnits = ice2fStakeUnits(
        recovery,
        ice2fEffectiveZeroShift(nextMachine),
      );
      const nextRecovery = ice2fRecoveryAfterWin(recovery, stakeMode, effectiveMax);
      nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
      nextStats = recordIce2fPairIndication(nextStats, active.pairId, "win");
      nextStats = recordIce2fIndicationOutcome(nextStats, "W");
      nextStats = recordIce2fClosedOutcome(nextStats, "W");
      statsChanged = true;
      nextMachine = ice2fClearCycleKeepGale(
        applyWinZeroRecoveryAccounting(nextMachine, wonUnits),
        nextRecovery,
      );
      nextMachine = {
        ...applyPairIndicationOutcome(nextMachine, active.pairId, "W"),
        lastClosedIndicationKey: closedKey,
      };
      nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else if (outcome === "continue") {
      // Empate: indicação única fecha; não conta falha; pares continuam em paralelo.
      nextMachine = {
        ...insistGateAfterTie(nextMachine, active.pairId, recovery),
        lastClosedIndicationKey: closedKey,
      };
      flash = {
        resultNumber,
        won: false,
        kind: "tie",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else {
      const nextRecovery = ice2fRecoveryAfterLoss(recovery, stakeMode);
      if (stakeMode === "positive") {
        // Positivo: cada L fecha a sequência (volta à base) — conta no placar.
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
        nextStats = recordIce2fPairIndication(nextStats, active.pairId, "loss");
        nextStats = recordIce2fIndicationOutcome(nextStats, "L");
        nextStats = recordIce2fClosedOutcome(nextStats, "L");
        statsChanged = true;
        nextMachine = {
          ...ice2fClearCycleKeepGale(nextMachine, 0),
          lastClosedIndicationKey: closedKey,
        };
        nextMachine = ice2fApplyPolarityRulesOnRecovery(
          nextMachine,
          nextRecovery,
          spinIndex,
        );
        nextMachine = applyPairIndicationOutcome(nextMachine, active.pairId, "L");
        nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
      } else if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
        nextStats = recordIce2fPairIndication(nextStats, active.pairId, "loss");
        nextStats = recordIce2fIndicationOutcome(nextStats, "L");
        nextStats = recordIce2fClosedOutcome(nextStats, "L");
        statsChanged = true;
        nextMachine = {
          ...ice2fClearCycleKeepGale(nextMachine, 0),
          nextEntryAxis: ice2fToggleAxis(active.axis),
          lastClosedIndicationKey: closedKey,
        };
        nextMachine = ice2fApplyPolarityRulesOnRecovery(
          nextMachine,
          nextRecovery,
          spinIndex,
        );
        nextMachine = applyPairIndicationOutcome(nextMachine, active.pairId, "L");
        nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
        nextStats = recordIce2fPairIndication(nextStats, active.pairId, "loss");
        nextStats = recordIce2fIndicationOutcome(nextStats, "L");
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
        nextMachine = armAfterLoss(
          nextMachine,
          historyNewestFirst,
          head,
          nextRecovery,
          active.axis,
        );
        nextMachine = {
          ...applyPairIndicationOutcome(nextMachine, active.pairId, "L"),
          lastClosedIndicationKey: closedKey,
        };
        nextMachine = ice2fApplyPolarityRulesOnRecovery(
          nextMachine,
          nextRecovery,
          spinIndex,
        );
        nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
      }
    }
  }

  // Após liquidar um resultado, pode rearmar no mesmo giro se for um match NOVO.
  // A chave lastClosedIndicationKey bloqueia apenas a repetição fantasma do mesmo 2×4.
  if (
    (!flash || justResolvedResult) &&
    !nextMachine.cycle &&
    headChanged &&
    historyNewestFirst.length >= getIce2fSoftMinHistory()
  ) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  if (
    !flash &&
    !nextMachine.cycle &&
    machine.lastSpinHead == null &&
    historyNewestFirst.length >= getIce2fSoftMinHistory()
  ) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
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

export type Ice2fPairIndicationBucket = { wins: number; losses: number };

export function emptyIce2fPairIndicationStats(): Record<string, Ice2fPairIndicationBucket> {
  const out: Record<string, Ice2fPairIndicationBucket> = {};
  for (const pair of getIce2fComparePairs()) {
    out[pair.id] = { wins: 0, losses: 0 };
  }
  return out;
}

function recordIce2fPairIndication(
  stats: RotatingRoomSessionStats,
  pairId: string | undefined,
  kind: "win" | "loss",
): RotatingRoomSessionStats {
  if (!pairId) return stats;
  const prev = stats.pairIndication ?? emptyIce2fPairIndicationStats();
  const slot = prev[pairId] ?? { wins: 0, losses: 0 };
  const nextSlot =
    kind === "win"
      ? { wins: slot.wins + 1, losses: slot.losses }
      : { wins: slot.wins, losses: slot.losses + 1 };
  return {
    ...stats,
    pairIndication: { ...prev, [pairId]: nextSlot },
  };
}

const ICE_2F_OUTCOME_HISTORY_MAX = 200;

function recordIce2fClosedOutcome(
  stats: RotatingRoomSessionStats,
  kind: "W" | "L",
): RotatingRoomSessionStats {
  const prev = Array.isArray(stats.outcomeHistory) ? stats.outcomeHistory : [];
  const next = [...prev, kind];
  if (next.length > ICE_2F_OUTCOME_HISTORY_MAX) {
    next.splice(0, next.length - ICE_2F_OUTCOME_HISTORY_MAX);
  }
  return { ...stats, outcomeHistory: next };
}

/** Cada indicação do gatilho (OK/ERR) — inclui derrotas durante gale. */
function recordIce2fIndicationOutcome(
  stats: RotatingRoomSessionStats,
  kind: "W" | "L",
): RotatingRoomSessionStats {
  const prev = Array.isArray(stats.indicationOutcomeHistory)
    ? stats.indicationOutcomeHistory
    : [];
  const next = [...prev, kind];
  if (next.length > ICE_2F_OUTCOME_HISTORY_MAX) {
    next.splice(0, next.length - ICE_2F_OUTCOME_HISTORY_MAX);
  }
  return { ...stats, indicationOutcomeHistory: next };
}

export type Ice2fStreakChartMetrics = {
  outcomes: Array<"W" | "L">;
  /** Streak de vitórias do placar (gale) após cada resultado. */
  winStreakSeries: number[];
  /** Streak de derrotas do gatilho (negativo) após cada indicação. */
  lossStreakSeries: number[];
  currentWinStreak: number;
  currentLossStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalWins: number;
  totalLosses: number;
  /** Totais OK/ERR do gatilho (indicações). */
  triggerWins: number;
  triggerLosses: number;
};

export function buildIce2fStreakChartMetrics(
  stats: RotatingRoomSessionStats | null | undefined,
): Ice2fStreakChartMetrics {
  const placarOutcomes = Array.isArray(stats?.outcomeHistory)
    ? stats!.outcomeHistory.filter((x): x is "W" | "L" => x === "W" || x === "L")
    : [];
  // Drawdown usa sequência do gatilho (cada indicação); fallback = placar.
  const triggerOutcomes = Array.isArray(stats?.indicationOutcomeHistory)
    ? stats!.indicationOutcomeHistory.filter((x): x is "W" | "L" => x === "W" || x === "L")
    : placarOutcomes;

  const winStreakSeries: number[] = [];
  let winStreak = 0;
  let maxWinStreak = 0;
  for (const o of placarOutcomes) {
    if (o === "W") {
      winStreak += 1;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else {
      winStreak = 0;
    }
    winStreakSeries.push(winStreak);
  }

  const lossStreakSeries: number[] = [];
  let lossStreak = 0;
  let maxLossStreak = 0;
  let triggerWins = 0;
  let triggerLosses = 0;
  for (const o of triggerOutcomes) {
    if (o === "L") {
      triggerLosses += 1;
      lossStreak += 1;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    } else {
      triggerWins += 1;
      lossStreak = 0;
    }
    lossStreakSeries.push(-lossStreak);
  }

  // Preferir contadores persistidos dos pares do gatilho se existirem.
  let pairWins = 0;
  let pairLosses = 0;
  let hasPair = false;
  for (const slot of Object.values(stats?.pairIndication ?? {})) {
    if (!slot) continue;
    hasPair = true;
    pairWins += slot.wins ?? 0;
    pairLosses += slot.losses ?? 0;
  }
  if (hasPair) {
    triggerWins = pairWins;
    triggerLosses = pairLosses;
  }

  return {
    outcomes: placarOutcomes,
    winStreakSeries,
    lossStreakSeries,
    currentWinStreak: winStreak,
    currentLossStreak: lossStreak,
    maxWinStreak,
    maxLossStreak,
    totalWins: stats?.wins ?? placarOutcomes.filter((x) => x === "W").length,
    totalLosses: stats?.losses ?? placarOutcomes.filter((x) => x === "L").length,
    triggerWins,
    triggerLosses,
  };
}

export function parseIce2fStats(
  raw: unknown,
  maxRecovery = ICE_2F_MAX_RECOVERY,
): RotatingRoomSessionStats {
  const parsed = parseRotatingRoomSessionStats(raw, maxRecovery);
  const base = emptyIce2fPairIndicationStats();
  const rawPairs = parsed.pairIndication ?? {};
  for (const id of Object.keys(base)) {
    const slot = rawPairs[id];
    if (slot) base[id] = { wins: slot.wins, losses: slot.losses };
  }
  for (const [id, slot] of Object.entries(rawPairs)) {
    if (!(id in base) && slot) base[id] = { wins: slot.wins, losses: slot.losses };
  }
  const outcomeHistory = Array.isArray(parsed.outcomeHistory)
    ? parsed.outcomeHistory.filter((x): x is "W" | "L" => x === "W" || x === "L").slice(-ICE_2F_OUTCOME_HISTORY_MAX)
    : [];
  const indicationOutcomeHistory = Array.isArray(parsed.indicationOutcomeHistory)
    ? parsed.indicationOutcomeHistory
        .filter((x): x is "W" | "L" => x === "W" || x === "L")
        .slice(-ICE_2F_OUTCOME_HISTORY_MAX)
    : [];
  return {
    ...parsed,
    pairIndication: base,
    outcomeHistory,
    indicationOutcomeHistory,
  };
}

export function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY): RotatingRoomSessionStats {
  return {
    ...emptyRotatingRoomSessionStats(maxRecovery),
    pairIndication: emptyIce2fPairIndicationStats(),
    outcomeHistory: [],
    indicationOutcomeHistory: [],
  };
}

export function formatIce2fWatchLabel(
  watch: Ice2fWatchCounters,
  _requiredFailures: number = ICE_2F_REQUIRED_FAILURES,
): string {
  const parts: string[] = [];
  for (const pair of getIce2fComparePairs()) {
    const f = watch[pair.id]?.failures ?? 0;
    if (pair.requiredFailures <= 0) {
      parts.push(`${pair.positions[0]}×${pair.positions[1]}`);
    } else {
      parts.push(
        `${pair.positions[0]}×${pair.positions[1]}:${f}/${pair.requiredFailures}`,
      );
    }
  }
  return parts.join(" · ") || "2F em comum";
}

export function ice2fWatchLabelForMachine(machine: Ice2fMachineState): string {
  const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
  const cycle = machine.cycle?.active;
  if (cycle) {
    const pair =
      cycle.pairId ??
      `pos${cycle.criticalPosition}/${cycle.matchPosition ?? "?"}`;
    return `${pair} ${axisShort(cycle.axis)} · gale ${machine.cycle?.recovery ?? 0}`;
  }
  const watchLabel = formatIce2fWatchLabel(machine.watch ?? emptyWatch());
  const obsCount = Object.keys(machine.pendingMatchObservations ?? {}).length;
  const obsHint = obsCount > 0 ? ` · obs ${obsCount}` : "";
  return pending > 0
    ? `${watchLabel}${obsHint} · gale ${pending}`
    : `${watchLabel}${obsHint}`;
}
