/**
 * Estrategia por ruas do tapete (transversais 1-2-3, 4-5-6, ... 34-35-36).
 * Historico sempre com o giro mais recente no indice 0.
 */

import {
  CRITICAL_HEIGHT_DEFAULT_GRID_INDICES,
  criticalHeightAlertAlignedWithRecentDominance,
  dominantColorParityFromTriple,
  evaluateCriticalHeightPairArmed,
  lastTwoSpinsInIndicationHalf,
  liveCriticalTripleSupportsZone,
  recentHalfDominanceZone,
  recentShortWindowIndicationHalfInMinority,
  type CriticalGatilhoArm,
  type CriticalHeightGatilhoOptions,
  type ZoneIndicationFromHeight,
} from "@/lib/roulette/criticalHeightGatilho";
import { evaluateRuas9NeighborGatilho } from "@/lib/roulette/ruas9PctNeighborGatilho";
import {
  mirrorConfirmationAlignsWithBetNumbers,
  MIRROR_CONFIRMATION_HISTORY_INDICES,
} from "@/lib/roulette/mirrorConfirmationColumn";
import {
  colorOf,
  heightOf,
  parityOf,
  sameHeightSameColor,
  sameHeightSameParity,
  isStreetPairTrigger,
  type Color,
  type Height,
  type Parity,
} from "@/lib/roulette/streetPairTrigger";

export {
  colorOf,
  heightOf,
  parityOf,
  sameHeightSameColor,
  sameHeightSameParity,
  isStreetPairTrigger,
} from "@/lib/roulette/streetPairTrigger";

export type { Height, Color, Parity } from "@/lib/roulette/streetPairTrigger";

export const CASINO_STREETS = [
  { id: 1, numbers: [1, 2, 3] as const },
  { id: 2, numbers: [4, 5, 6] as const },
  { id: 3, numbers: [7, 8, 9] as const },
  { id: 4, numbers: [10, 11, 12] as const },
  { id: 5, numbers: [13, 14, 15] as const },
  { id: 6, numbers: [16, 17, 18] as const },
  { id: 7, numbers: [19, 20, 21] as const },
  { id: 8, numbers: [22, 23, 24] as const },
  { id: 9, numbers: [25, 26, 27] as const },
  { id: 10, numbers: [28, 29, 30] as const },
  { id: 11, numbers: [31, 32, 33] as const },
  { id: 12, numbers: [34, 35, 36] as const },
] as const;

/** Janela inicial de frieza (sufixo cronológico mais recente). */
export const STREET_STRATEGY_FRIA_WINDOW_INITIAL = 20;
/** Passo ao ampliar a janela quando há empate de frequências no pool. */
export const STREET_STRATEGY_FRIA_WINDOW_STEP = 5;
/** Tecto da janela (giros mais recentes têm sempre prioridade — a janela é sempre um sufixo). */
export const STREET_STRATEGY_FRIA_WINDOW_MAX = 100;
/**
 * Alias = inicial: usado por defeito em `pickExclusionDisplayNumbers` e opções legadas.
 * A simulação usa `resolveFriezaWindowNums` (20 → expande até 100 se empate global no pool).
 */
export const STREET_STRATEGY_FRIA_WINDOW = STREET_STRATEGY_FRIA_WINDOW_INITIAL;

/** Giros mais recentes a considerar: ruas com qualquer casa aqui nao entram na exclusao (procura-se outra). */
export const STREET_EXCLUSION_RECENT_SPINS = 12;

/**
 * Fila **visual** na grelha 3×12 (cima / meio / baixo), **independente** de Baixo/Alto (1–18 vs 19–36).
 * **1** = linha de cima (3,6,9,…), **2** = meio (2,5,8,…), **3** = baixo (1,4,7,…). Zero → null.
 */
export function matTableRowOf(n: number): 1 | 2 | 3 | null {
  if (n === 0) return null;
  const m = n % 3;
  if (m === 0) return 1;
  if (m === 2) return 2;
  return 3;
}

/** Rua 1..12 ou null para o zero */
export function streetIdForNumber(n: number): number | null {
  if (n === 0) return null;
  return Math.ceil(n / 3);
}

export function streetFrequencies(history: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const s of CASINO_STREETS) counts.set(s.id, 0);
  for (const n of history) {
    const sid = streetIdForNumber(n);
    if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }
  return counts;
}

/** True se algum numero da transversal `streetId` saiu nos `recentCount` giros mais recentes (historico indice 0 = mais recente). */
export function streetHasAnyNumberInRecentSpins(
  streetId: number,
  historyNewestFirst: number[],
  recentCount: number,
): boolean {
  const row = CASINO_STREETS.find((s) => s.id === streetId);
  if (!row) return false;
  const cells = new Set<number>(row.numbers);
  const n = Math.min(recentCount, historyNewestFirst.length);
  for (let i = 0; i < n; i++) {
    const v = historyNewestFirst[i]!;
    if (v !== 0 && cells.has(v)) return true;
  }
  return false;
}

/** Frequências por número 1–36 dentro dos giros da janela (Números 2,8% / `resolveFriezaWindowNums`). */
export function numberFrequenciesInFriezaWindow(
  windowNums: readonly number[],
): Map<number, number> {
  const m = new Map<number, number>();
  for (let n = 1; n <= 36; n++) m.set(n, 0);
  for (const x of windowNums) {
    if (x >= 1 && x <= 36) m.set(x, (m.get(x) ?? 0) + 1);
  }
  return m;
}

/** True se todas as entidades do `pool` têm a mesma contagem em `counts` (empate global de frieza). */
function poolFreqMinEqualsMax(
  pool: readonly number[],
  counts: ReadonlyMap<number, number>,
): boolean {
  if (pool.length < 2) return false;
  let mn = Infinity;
  let mx = -1;
  for (const id of pool) {
    const v = counts.get(id) ?? 0;
    mn = Math.min(mn, v);
    mx = Math.max(mx, v);
  }
  return mn === mx;
}

/**
 * Janela de frieza ancorada nos giros **mais recentes**: sufixo cronológico de comprimento W (W inicia em 20,
 * aumenta de 5 em 5 até `STREET_STRATEGY_FRIA_WINDOW_MAX` ou o prefixo disponível).
 *
 * 1. **Candidatos "ausentes":** começa com N = `STREET_EXCLUSION_RECENT_SPINS` (12); se o pool tiver menos de
 *    `minEligible` ruas/números sem saída nos últimos N giros, diminui N até 0 (prioridade continua a ser
 *    não tocar nos giros mais recentes enquanto houver alternativa).
 * 2. **Empate de frieza:** se todas as frequências no pool (na janela actual) forem iguais, amplia W para
 *    incorporar giros mais antigos até haver dispersão ou atingir o tecto.
 */
export function resolveFriezaWindowNums(
  chronological: readonly number[],
  chronIdx: number,
  historyNewestFirst: readonly number[],
  args: { pool: readonly number[]; minEligible: number; mode: "streets" | "numbers" },
): { windowNums: number[]; recentCap: number; windowLen: number } {
  const prefix = chronIdx + 1;
  const maxW = Math.min(STREET_STRATEGY_FRIA_WINDOW_MAX, prefix);
  const slice = (w: number) => [
    ...chronological.slice(Math.max(0, chronIdx + 1 - w), chronIdx + 1),
  ];

  let recentCap = STREET_EXCLUSION_RECENT_SPINS;
  const eligibleCount = (): number => {
    if (args.mode === "streets") {
      return args.pool.filter(
        (sid) => !streetHasAnyNumberInRecentSpins(sid, [...historyNewestFirst], recentCap),
      ).length;
    }
    const lim = Math.min(recentCap, historyNewestFirst.length);
    return args.pool.filter((n) => {
      for (let j = 0; j < lim; j++) {
        if (historyNewestFirst[j] === n) return false;
      }
      return true;
    }).length;
  };

  while (recentCap > 0 && eligibleCount() < args.minEligible) {
    recentCap -= 1;
  }

  let W = Math.min(STREET_STRATEGY_FRIA_WINDOW_INITIAL, prefix);
  let windowNums = slice(W);
  const buildCounts = (): Map<number, number> =>
    args.mode === "streets"
      ? streetFrequencies(windowNums)
      : numberFrequenciesInFriezaWindow(windowNums);

  let counts = buildCounts();
  while (W < maxW && poolFreqMinEqualsMax(args.pool, counts)) {
    const nextW = Math.min(maxW, W + STREET_STRATEGY_FRIA_WINDOW_STEP);
    if (nextW === W) break;
    W = nextW;
    windowNums = slice(W);
    counts = buildCounts();
  }

  return { windowNums, recentCap, windowLen: W };
}

function sortStreetIdsByColdness(ids: readonly number[], counts: Map<number, number>): number[] {
  return [...ids].sort((a, b) => {
    const fa = counts.get(a) ?? 0;
    const fb = counts.get(b) ?? 0;
    if (fa !== fb) return fa - fb;
    return a - b;
  });
}

/**
 * Uma rua mais fria no `pool` (menor frequencia; empate: menor id), com a mesma regra dos
 * ultimos `STREET_EXCLUSION_RECENT_SPINS` giros que `pickTwoColdestStreets`.
 */
export function pickOneColdestStreet(
  pool: readonly number[],
  counts: Map<number, number>,
  historyNewestFirst?: number[],
  recentSpinsGate: number = STREET_EXCLUSION_RECENT_SPINS,
): number {
  const recent = recentSpinsGate;
  const absentFromRecent = (streetId: number) =>
    !historyNewestFirst || !streetHasAnyNumberInRecentSpins(streetId, historyNewestFirst, recent);

  if (historyNewestFirst && historyNewestFirst.length > 0) {
    const eligible = pool.filter((sid) => absentFromRecent(sid));
    if (eligible.length >= 1) {
      return sortStreetIdsByColdness(eligible, counts)[0]!;
    }
  }

  return sortStreetIdsByColdness(pool, counts)[0]!;
}

/**
 * Quantos dos 3 factores (altura, cor, paridade) de `n` coincidem com **pelo menos um** dos numeros do triplo do gatilho.
 * Usado na Ruas 9% para desempatar: preferir excluir rua cujo numero «frio» esta menos «alinhado» com o gatilho.
 */
export function gatilhoTripleFactorOverlapScore(
  n: number,
  triple: readonly [number, number, number],
): number {
  if (n === 0) return 99;
  let score = 0;
  const hn = heightOf(n);
  const cn = colorOf(n);
  const pn = parityOf(n);
  if (hn !== "Zero" && triple.some((t) => t !== 0 && heightOf(t) === hn)) score += 1;
  if (cn !== "Zero" && triple.some((t) => t !== 0 && colorOf(t) === cn)) score += 1;
  if (pn !== "Zero" && triple.some((t) => t !== 0 && parityOf(t) === pn)) score += 1;
  return score;
}

/** Igual a `pickOneColdestStreet`, mas em empates de frieza escolhe a rua cujo numero de exclusao tem menor `gatilhoTripleFactorOverlapScore` com o triplo. */
function pickOneColdestStreetLeastGatilhoOverlap(
  pool: readonly number[],
  counts: Map<number, number>,
  historyNewestFirst: number[],
  triple: readonly [number, number, number],
  windowOpts?: { streetCountWindow?: number; recentSpinsGate?: number },
): number {
  const recent = windowOpts?.recentSpinsGate ?? STREET_EXCLUSION_RECENT_SPINS;
  const absentFromRecent = (streetId: number) =>
    !historyNewestFirst || !streetHasAnyNumberInRecentSpins(streetId, historyNewestFirst, recent);

  let work = [...pool];
  if (historyNewestFirst && historyNewestFirst.length > 0) {
    const eligible = pool.filter((sid) => absentFromRecent(sid));
    if (eligible.length >= 1) work = eligible;
  }

  work.sort((sidA, sidB) => {
    const fa = counts.get(sidA) ?? 0;
    const fb = counts.get(sidB) ?? 0;
    if (fa !== fb) return fa - fb;
    const coldA = pickExclusionDisplayNumbers([sidA] as const, historyNewestFirst, windowOpts)[0]!;
    const coldB = pickExclusionDisplayNumbers([sidB] as const, historyNewestFirst, windowOpts)[0]!;
    const oa = gatilhoTripleFactorOverlapScore(coldA, triple);
    const ob = gatilhoTripleFactorOverlapScore(coldB, triple);
    if (oa !== ob) return oa - ob;
    return sidA - sidB;
  });
  return work[0]!;
}

/** Ruas 1–6 = apenas numeros **Baixo (1–18)**. */
export function lowHalfStreetIds(): readonly number[] {
  return [1, 2, 3, 4, 5, 6];
}

/** Ruas 7–12 = apenas numeros **Alto (19–36)**. */
export function highHalfStreetIds(): readonly number[] {
  return [7, 8, 9, 10, 11, 12];
}

/**
 * **Armar Gatilho 1** com os tres giros mais recentes no tempo: **A→B→C** (mais antigo → mais recente).
 * O par **B→C** cumpre `isStreetPairTrigger`; **A** (o terceiro mais recente = mais antigo dos tres) deve ter a **mesma metade**
 * Baixo/Alto que B e C. Zero em A nao arma.
 */
export function isStreetGatilho1ArmTriple(a: number, b: number, c: number): boolean {
  if (!isStreetPairTrigger(b, c)) return false;
  const ha = heightOf(a);
  if (ha === "Zero") return false;
  return ha === heightOf(b);
}

/**
 * Tres giros A→B→C (mais antigo → mais recente): passo previo **so metade** (Baixo/Alto) A→B e par B→C completo.
 * @deprecated A simulacao usa apenas o par consecutivo (Gatilho 1); mantido para referencia.
 */
export function isStreetTriggerWithHeightLeadIn(a: number, b: number, c: number): boolean {
  if (a === 0 || b === 0 || c === 0) return false;
  const ha = heightOf(a);
  const hb = heightOf(b);
  if (ha === "Zero" || hb === "Zero" || ha !== hb) return false;
  return isStreetPairTrigger(b, c);
}

export type StreetPairTriggerKind = "altura-cor" | "altura-paridade" | "ambos";

/** Igual a `StreetPairTriggerKind` (apenas Gatilho 1). Mantido por compatibilidade de tipos. */
export type StreetTriggerKind = StreetPairTriggerKind;

export function streetPairTriggerKind(older: number, newer: number): StreetPairTriggerKind | null {
  if (!isStreetPairTrigger(older, newer)) return null;
  const hc = sameHeightSameColor(older, newer);
  const hp = sameHeightSameParity(older, newer);
  if (hc && hp) return "ambos";
  if (hc) return "altura-cor";
  return "altura-paridade";
}

export type ZoneIndication = "1-18" | "19-36";

/** Zona de alerta = metade do ultimo do par: **1-18** (Baixo) ou **19-36** (Alto). */
export function zoneForTriggerPair(older: number, newer: number): ZoneIndication | null {
  if (!isStreetPairTrigger(older, newer)) return null;
  return heightOf(newer) === "Alto" ? "19-36" : "1-18";
}

export function exclusionPoolForZone(zone: ZoneIndication): readonly number[] {
  return zone === "19-36" ? lowHalfStreetIds() : highHalfStreetIds();
}

/** Metade exterior oposta (Baixo ↔ Alto). */
export function oppositeZoneIndication(zone: ZoneIndication): ZoneIndication {
  return zone === "19-36" ? "1-18" : "19-36";
}

export type StreetStrategyActive = {
  zone: ZoneIndication;
  excludedStreetIds: readonly [number] | readonly [number, number];
  triggerKind: StreetPairTriggerKind;
  /** Mais recente do par B→C (Gatilho 1). */
  triggerNewerNumber: number;
  /**
   * Tres numeros (mais antigo → mais recente) no momento em que armou o Gatilho 1; mantido durante a continuacao.
   * Classico: A→B→C reais. Com `gatilho1PairOnly` e so dois giros ao armar, guarda-se [B, C, C] para o desempate 9%.
   */
  gatilhoTriple: readonly [number, number, number];
  /**
   * Texto fixo no momento em que a indicacao armou.
   * Inicio: triplo A→B→C; continuacao: par consecutivo na zona.
   */
  armingDescription: string;
};

export type StreetStrategyResult = {
  active: StreetStrategyActive | null;
  /** Passos relevantes para o utilizador perceber o estado final */
  log: string[];
};

/** Padrao `exclusionStreetCount`: 2 (aba Ruas). Use 1 para excluir apenas uma rua (aba Ruas 9%). Exclusao por frieza na janela. */
export type SimulateStreetStrategyOptions = {
  exclusionStreetCount?: 1 | 2;
  /**
   * Aba «Dois fatores»: com indicacao activa, apos cada giro avalia metade+cor/paridade;
   * se **ambos** ganharem ou **ambos** perderem num so sorteio, encerra a indicacao (nao continua como nas ruas).
   */
  twoFactorMode?: boolean;
  /**
   * Quando `true` (ex.: Ruas 9% invertida): apos o Gatilho 1, a **caixa exterior** e a metade **oposta** a
   * `zoneForTriggerPair` (a do par B→C); as transversais cobertas passam a ser as do semiciclo correspondente a
   * essa metade (pool `exclusionPoolForZone` da zona activa). Exclusoes: **só frieza** na janela (e desempate 9% com
   * uma rua); com uma rua excluida mantem-se o desempate por menor sobreposicao com o triplo A→B→C.
   */
  invertIndicationHalf?: boolean;
  /**
   * Quando `true` (ex.: Ruas 9%): o Gatilho 1 **arma** com o par consecutivo **B→C** (metade+cor ou metade+paridade)
   * sem exigir que o giro **A** (imediatamente anterior a B) esteja na mesma metade Baixo/Alto que o par.
   * Bastam **dois** giros consecutivos validos. Se existir A, entra no triplo guardado para desempate / historico.
   */
  gatilho1PairOnly?: boolean;
  /**
   * Ruas 20% / 9% com **espelho de altura**: **não** usa o Gatilho 1 clássico (triplo **A→B→C** no tapete).
   * O armamento vem só do **par crítico** nas posições da grelha (`criticalHeightGridIndices`, omisso **11** e **22**);
   * ficha exterior na **metade da indicação**; transversais no semiciclo oposto; exclusões pela frieza.
   * Ignora `gatilho1PairOnly` / `invertIndicationHalf` para armar (continuação segue o par na zona).
   */
  mirrorHeightIndication?: boolean;
  /**
   * Índices em `historyNewestFirst` (0 = mais recente) para o par crítico com `mirrorHeightIndication`.
   * Omisso = `[10, 21]` (posições **11** e **22** na grelha). Ruas 9% usa `[10, 11]` (**11** e **12**).
   */
  criticalHeightGridIndices?: readonly [number, number];
  /**
   * Ruas 20%: giro numa **transversal com ficha** (semicíclio apostado, não excluída) conta como **empate** (`D`),
   * não como vitória. Continuação da indicação inalterada. A caixa exterior na metade indicada mantém **W**.
   */
  placarBetStreetsAsDraws?: boolean;
  /**
   * **Ruas 9% — gatilho grelha 11×2**: pos. **1** e **12** comparam metade; pos. **11** é a base.
   * Mesmo grupo nas críticas → metade alvo = pos. 11; grupos diferentes → metade oposta. Zero em 1 ou 12 bloqueia.
   */
  ruas9NeighborGatilho?: boolean;
};

function criticalHeightOptsFromStreetOpts(
  opts?: SimulateStreetStrategyOptions,
): CriticalHeightGatilhoOptions | undefined {
  const g = opts?.criticalHeightGridIndices;
  return g ? { gridIndices: g } : undefined;
}

/** Avaliador de armamento conforme as opções (par crítico clássico ou gatilho do vizinho da Ruas 9%). */
function evaluateGatilhoForOpts(
  historyNewestFirst: readonly number[],
  opts?: SimulateStreetStrategyOptions,
): CriticalGatilhoArm | null {
  if (opts?.ruas9NeighborGatilho) {
    return evaluateRuas9NeighborGatilho(historyNewestFirst);
  }
  return evaluateCriticalHeightPairArmed(
    historyNewestFirst,
    criticalHeightOptsFromStreetOpts(opts),
  );
}

/** Continuação alinhada com o gatilho activo (par crítico clássico vs vizinho Ruas 9%). */
function liveGatilhoSupportsZoneForOpts(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
  opts?: SimulateStreetStrategyOptions,
): boolean {
  if (opts?.ruas9NeighborGatilho) {
    const g = evaluateRuas9NeighborGatilho(historyNewestFirst);
    return g !== null && g.zone === zone;
  }
  return liveCriticalTripleSupportsZone(
    historyNewestFirst,
    zone,
    criticalHeightOptsFromStreetOpts(opts),
  );
}

/** Alinhamento do alerta prioritário com a tendência recente, adaptado ao gatilho activo. */
function alertAlignedWithDominanceForOpts(
  historyNewestFirst: readonly number[],
  opts?: SimulateStreetStrategyOptions,
): boolean {
  if (opts?.ruas9NeighborGatilho) {
    const g = evaluateRuas9NeighborGatilho(historyNewestFirst);
    if (!g) return false;
    if (!lastTwoSpinsInIndicationHalf(historyNewestFirst, g.zone)) return false;
    const dom = recentHalfDominanceZone(historyNewestFirst);
    if (dom !== null && dom !== g.zone) return false;
    if (recentShortWindowIndicationHalfInMinority(historyNewestFirst, g.zone)) return false;
    return true;
  }
  return criticalHeightAlertAlignedWithRecentDominance(
    historyNewestFirst,
    criticalHeightOptsFromStreetOpts(opts),
  );
}

/** Rótulo humano das posições na grelha (1-based): ex. `[10,11]` → `11. e 12.`. */
function criticalHeightGridOrdinalLabel(indices: readonly [number, number]): string {
  const lo = Math.min(indices[0], indices[1]) + 1;
  const hi = Math.max(indices[0], indices[1]) + 1;
  return `${lo}. e ${hi}.`;
}

/** Resultado de um giro no placar por ruas excluídas (`D` = empate). */
export type StreetPlacarOutcome = "W" | "L" | "D";

/**
 * Onde colocar fichas no tapete com indicacao ativa: todas as ruas do semiciclo **oposto**
 * a zona do alerta, exceto as ruas excluidas (uma ou duas); mais uma ficha na caixa exterior da zona
 * (**Baixo** 1–18 ou **Alto** 19–36).
 */
export function streetBetTargetsFromActive(active: StreetStrategyActive): {
  streetIds: number[];
  outsideZone: ZoneIndication;
} {
  const pool = exclusionPoolForZone(active.zone);
  const skip = new Set<number>(active.excludedStreetIds);
  const streetIds = pool.filter((id) => !skip.has(id)).sort((a, b) => a - b);
  return { streetIds, outsideZone: active.zone };
}

/** Todas as casas 1–36 cobertas pelas transversais activas (sem a caixa exterior). */
export function streetBetCellNumbersFromActive(active: StreetStrategyActive): number[] {
  const { streetIds } = streetBetTargetsFromActive(active);
  const nums: number[] = [];
  for (const id of streetIds) {
    const def = CASINO_STREETS.find((s) => s.id === id);
    if (def) nums.push(...def.numbers);
  }
  return nums;
}

/**
 * Duas ruas mais frias no `pool` segundo `counts` (menor frequencia primeiro; empate: menor id).
 * Se `historyNewestFirst` for passado, **nao** escolhe ruas que tenham qualquer numero nos
 * ultimos `STREET_EXCLUSION_RECENT_SPINS` giros; se nao existirem duas ruas assim no pool,
 * completa com as mais frias entre as restantes (ultimo recurso).
 */
export function pickTwoColdestStreets(
  pool: readonly number[],
  counts: Map<number, number>,
  historyNewestFirst?: number[],
  recentSpinsGate: number = STREET_EXCLUSION_RECENT_SPINS,
): [number, number] {
  const recent = recentSpinsGate;
  const absentFromRecent = (streetId: number) =>
    !historyNewestFirst || !streetHasAnyNumberInRecentSpins(streetId, historyNewestFirst, recent);

  if (historyNewestFirst && historyNewestFirst.length > 0) {
    const eligible = pool.filter((sid) => absentFromRecent(sid));
    if (eligible.length >= 2) {
      const s = sortStreetIdsByColdness(eligible, counts);
      return [s[0]!, s[1]!];
    }
    if (eligible.length === 1) {
      const first = eligible[0]!;
      const restOk = pool.filter((sid) => sid !== first && absentFromRecent(sid));
      if (restOk.length >= 1) {
        const s = sortStreetIdsByColdness(restOk, counts);
        return [first, s[0]!];
      }
      const rest = pool.filter((sid) => sid !== first);
      const s = sortStreetIdsByColdness(rest, counts);
      return [first, s[0]!];
    }
  }

  const sorted = sortStreetIdsByColdness(pool, counts);
  return [sorted[0]!, sorted[1]!];
}

/**
 * Um numero por rua excluida: o da transversal com menos aparicoes na janela
 * (por defeito ultimas `STREET_STRATEGY_FRIA_WINDOW` rodadas mais recentes; empate: menor numero).
 */
export function pickExclusionDisplayNumbers(
  excludedStreetIds: readonly [number] | readonly [number, number],
  historyNewestFirst: number[],
  opts?: { streetCountWindow?: number },
): number[] {
  const win = opts?.streetCountWindow ?? STREET_STRATEGY_FRIA_WINDOW;
  const window = historyNewestFirst.slice(0, Math.min(win, historyNewestFirst.length));
  const pickOne = (streetId: number): number => {
    const row = CASINO_STREETS.find((s) => s.id === streetId);
    if (!row) return streetId;
    let best: number = row.numbers[0]!;
    let bestC = window.filter((h) => h === best).length;
    for (const n of row.numbers) {
      const c = window.filter((h) => h === n).length;
      if (c < bestC || (c === bestC && n < best)) {
        best = n;
        bestC = c;
      }
    }
    return best;
  };
  return excludedStreetIds.map((id) => pickOne(id));
}

export function countSharedRouletteCharacteristics(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  let n = 0;
  const ha = heightOf(a);
  const hb = heightOf(b);
  if (ha !== "Zero" && ha === hb) n++;
  const ca = colorOf(a);
  const cb = colorOf(b);
  if (ca !== "Zero" && ca === cb) n++;
  const pa = parityOf(a);
  const pb = parityOf(b);
  if (pa !== "Zero" && pa === pb) n++;
  return n;
}

function triggerKindLabel(k: StreetPairTriggerKind): string {
  if (k === "ambos") return "Baixo/Alto (1–18 ou 19–36), cor e paridade";
  if (k === "altura-cor") return "Baixo/Alto + cor";
  return "Baixo/Alto + paridade";
}

/** Filtro de predominancia derivado do par B→C (usa o ultimo numero C e o tipo de gatilho). */
export type DominantStreetFilter =
  | { type: "color"; color: Exclude<Color, "Zero"> }
  | { type: "parity"; parity: Exclude<Parity, "Zero"> }
  | { type: "both"; color: Exclude<Color, "Zero">; parity: Exclude<Parity, "Zero"> };

export function dominantFilterFromTriggerKind(
  kind: StreetPairTriggerKind,
  c: number,
): DominantStreetFilter | null {
  if (c === 0) return null;
  if (kind === "altura-cor") {
    const col = colorOf(c);
    if (col === "Zero") return null;
    return { type: "color", color: col };
  }
  if (kind === "altura-paridade") {
    const p = parityOf(c);
    if (p === "Zero") return null;
    return { type: "parity", parity: p };
  }
  const col = colorOf(c);
  const p = parityOf(c);
  if (col === "Zero" || p === "Zero") return null;
  return { type: "both", color: col, parity: p };
}

export function dominantFilterLabel(f: DominantStreetFilter): string {
  if (f.type === "color") return f.color === "Vermelho" ? "vermelho" : "preto";
  if (f.type === "parity") return f.parity === "Par" ? "par" : "impar";
  return `${f.color === "Vermelho" ? "vermelho" : "preto"} + ${f.parity === "Par" ? "par" : "impar"}`;
}

/** Resultado de um giro com indicacao «dois fatores» (metade + cor/paridade). */
export type TwoFactorRoundOutcome = "double-win" | "double-loss" | "continue";

/**
 * Factores: (1) metade da zona `active.zone`; (2) cor ou paridade do numero de referencia `triggerNewerNumber`,
 * conforme `triggerKind` (`altura-cor`, `altura-paridade`, ou `ambos` = cor **e** paridade em simultaneo).
 * Zero no giro: perde metade; cor/paridade tratadas como no tapete (zero perde apostas exteriores).
 */
export function evaluateTwoFactorRound(
  num: number,
  active: StreetStrategyActive,
): TwoFactorRoundOutcome {
  const { zone, triggerKind, triggerNewerNumber: ref } = active;

  const f1Win = num !== 0 && (zone === "1-18" ? num <= 18 : num >= 19);
  const f1Lose = num === 0 || (zone === "1-18" ? num >= 19 : num <= 18);

  const colRef = colorOf(ref);
  const parRef = parityOf(ref);

  let f2Win = false;
  let f2Lose = false;

  if (triggerKind === "altura-cor") {
    if (colRef === "Zero") return "continue";
    f2Win = num !== 0 && colorOf(num) === colRef;
    f2Lose = num === 0 || (num !== 0 && colorOf(num) !== colRef);
  } else if (triggerKind === "altura-paridade") {
    if (parRef === "Zero") return "continue";
    f2Win = num !== 0 && parityOf(num) === parRef;
    f2Lose = num === 0 || (num !== 0 && parityOf(num) !== parRef);
  } else {
    if (colRef === "Zero" || parRef === "Zero") return "continue";
    const cWin = num !== 0 && colorOf(num) === colRef;
    const pWin = num !== 0 && parityOf(num) === parRef;
    f2Win = cWin && pWin;
    f2Lose = num === 0 || !cWin || !pWin;
  }

  if (f1Win && f2Win) return "double-win";
  if (f1Lose && f2Lose) return "double-loss";
  return "continue";
}

function countStreetCellsMatchingDominantFilter(
  streetId: number,
  filter: DominantStreetFilter,
): number {
  const row = CASINO_STREETS.find((s) => s.id === streetId);
  if (!row) return 0;
  let n = 0;
  for (const cell of row.numbers) {
    if (filter.type === "color") {
      if (colorOf(cell) === filter.color) n++;
    } else if (filter.type === "parity") {
      if (parityOf(cell) === filter.parity) n++;
    } else if (colorOf(cell) === filter.color && parityOf(cell) === filter.parity) {
      n++;
    }
  }
  return n;
}

/** Ruas do pool com o minimo de casas que coincidem com o filtro (patamar mais baixo). */
export function predominantExclusionMinTierStreetIds(
  pool: readonly number[],
  filter: DominantStreetFilter,
): number[] {
  let minC = Infinity;
  const rows = pool.map((sid) => ({
    sid,
    c: countStreetCellsMatchingDominantFilter(sid, filter),
  }));
  for (const x of rows) minC = Math.min(minC, x.c);
  if (!Number.isFinite(minC)) return [];
  return rows.filter((x) => x.c === minC).map((x) => x.sid);
}

/** Uniao dos dois patamares mais baixos de coincidencias (para escolher 2 ruas mais frias). */
export function predominantExclusionCandidatePool(
  pool: readonly number[],
  filter: DominantStreetFilter,
): number[] {
  const rows = pool.map((sid) => ({
    sid,
    c: countStreetCellsMatchingDominantFilter(sid, filter),
  }));
  if (rows.length === 0) return [];
  const distinct = [...new Set(rows.map((x) => x.c))].sort((a, b) => a - b);
  const c0 = distinct[0]!;
  const c1 = distinct[1] ?? c0;
  return rows.filter((x) => x.c === c0 || x.c === c1).map((x) => x.sid);
}

function pickExcludedStreetsByColdness(
  pool: readonly number[],
  freq: Map<number, number>,
  histAtNewestFirst: number[],
  exclN: 1 | 2,
  _triggerKind: StreetPairTriggerKind,
  _triggerNewer: number,
  recentSpinsGate: number,
  friezaWindowLen: number,
  gatilhoTriple?: readonly [number, number, number],
): readonly [number] | readonly [number, number] {
  const winOpts = { streetCountWindow: friezaWindowLen, recentSpinsGate };
  return exclN === 1
    ? gatilhoTriple
      ? ([
          pickOneColdestStreetLeastGatilhoOverlap(
            pool,
            freq,
            histAtNewestFirst,
            gatilhoTriple,
            winOpts,
          ),
        ] as const)
      : ([pickOneColdestStreet(pool, freq, histAtNewestFirst, recentSpinsGate)] as const)
    : pickTwoColdestStreets(pool, freq, histAtNewestFirst, recentSpinsGate);
}

function matchesDominantColorParityProfile(
  n: number,
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
): boolean {
  if (n === 0) return false;
  return colorOf(n) === dc && parityOf(n) === dp;
}

function streetCriticalExclusionScore(
  streetId: number,
  numFreq: Map<number, number>,
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
): number {
  const row = CASINO_STREETS.find((s) => s.id === streetId);
  if (!row) return 999;
  const weak = row.numbers.filter((n) => !matchesDominantColorParityProfile(n, dc, dp));
  const cells = weak.length > 0 ? weak : [...row.numbers];
  let mn = Infinity;
  for (const c of cells) mn = Math.min(mn, numFreq.get(c) ?? 0);
  return mn;
}

function sortStreetIdsByCriticalExclusionScore(
  pool: readonly number[],
  numFreq: Map<number, number>,
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
): number[] {
  return [...pool].sort((a, b) => {
    const sa = streetCriticalExclusionScore(a, numFreq, dc, dp);
    const sb = streetCriticalExclusionScore(b, numFreq, dc, dp);
    if (sa !== sb) return sa - sb;
    return a - b;
  });
}

function pickTwoColdestStreetsCriticalDominant(
  pool: readonly number[],
  numFreq: Map<number, number>,
  historyNewestFirst: number[],
  recentSpinsGate: number,
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
): [number, number] {
  const sorted = sortStreetIdsByCriticalExclusionScore(pool, numFreq, dc, dp);
  const absentFromRecent = (streetId: number) =>
    !historyNewestFirst ||
    !streetHasAnyNumberInRecentSpins(streetId, historyNewestFirst, recentSpinsGate);

  if (historyNewestFirst && historyNewestFirst.length > 0) {
    const eligible = sorted.filter((sid) => absentFromRecent(sid));
    if (eligible.length >= 2) return [eligible[0]!, eligible[1]!];
    if (eligible.length === 1) {
      const first = eligible[0]!;
      const restOk = sorted.filter((sid) => sid !== first && absentFromRecent(sid));
      if (restOk.length >= 1) return [first, restOk[0]!];
      const rest = sorted.filter((sid) => sid !== first);
      return [first, rest[0]!];
    }
  }

  return [sorted[0]!, sorted[1]!];
}

function pickOneColdestStreetCriticalWithTripleTiebreak(
  pool: readonly number[],
  numFreq: Map<number, number>,
  historyNewestFirst: number[],
  triple: readonly [number, number, number],
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
  windowOpts?: { streetCountWindow?: number; recentSpinsGate?: number },
): number {
  const recent = windowOpts?.recentSpinsGate ?? STREET_EXCLUSION_RECENT_SPINS;
  const absentFromRecent = (streetId: number) =>
    !historyNewestFirst || !streetHasAnyNumberInRecentSpins(streetId, historyNewestFirst, recent);

  const sorted = sortStreetIdsByCriticalExclusionScore(pool, numFreq, dc, dp);
  let work = [...sorted];
  if (historyNewestFirst && historyNewestFirst.length > 0) {
    const eligible = sorted.filter((sid) => absentFromRecent(sid));
    if (eligible.length >= 1) work = eligible;
  }

  work.sort((sidA, sidB) => {
    const sa = streetCriticalExclusionScore(sidA, numFreq, dc, dp);
    const sb = streetCriticalExclusionScore(sidB, numFreq, dc, dp);
    if (sa !== sb) return sa - sb;
    const coldA = pickExclusionDisplayNumbers([sidA] as const, historyNewestFirst, windowOpts)[0]!;
    const coldB = pickExclusionDisplayNumbers([sidB] as const, historyNewestFirst, windowOpts)[0]!;
    const oa = gatilhoTripleFactorOverlapScore(coldA, triple);
    const ob = gatilhoTripleFactorOverlapScore(coldB, triple);
    if (oa !== ob) return oa - ob;
    return sidA - sidB;
  });
  return work[0]!;
}

function pickExcludedStreetsForCriticalGatilho(
  pool: readonly number[],
  windowNums: readonly number[],
  histAtNewestFirst: number[],
  exclN: 1 | 2,
  triple: readonly [number, number, number],
  dc: Exclude<Color, "Zero">,
  dp: Exclude<Parity, "Zero">,
  recentSpinsGate: number,
  friezaWindowLen: number,
): readonly [number] | readonly [number, number] {
  const numFreq = numberFrequenciesInFriezaWindow(windowNums);
  const winOpts = { streetCountWindow: friezaWindowLen, recentSpinsGate };
  if (exclN === 1) {
    return [
      pickOneColdestStreetCriticalWithTripleTiebreak(
        pool,
        numFreq,
        histAtNewestFirst,
        triple,
        dc,
        dp,
        winOpts,
      ),
    ] as const;
  }
  return pickTwoColdestStreetsCriticalDominant(
    pool,
    numFreq,
    histAtNewestFirst,
    recentSpinsGate,
    dc,
    dp,
  );
}

/** Recalcula ruas excluidas pela frieza no semiciclo (janela + preferencia sem numeros recentes nas ruas). */
function recomputeActiveExclusions(
  prevActive: StreetStrategyActive,
  i: number,
  chronological: number[],
  exclN: 1 | 2,
  useCriticalGatilhoExclusions: boolean,
): {
  next: StreetStrategyActive;
  changed: boolean;
  excluded: readonly [number] | readonly [number, number];
} {
  const pool = exclusionPoolForZone(prevActive.zone);
  const histAtNewestFirst = [...chronological.slice(0, i + 1)].reverse();
  const { windowNums, recentCap, windowLen } = resolveFriezaWindowNums(
    chronological,
    i,
    histAtNewestFirst,
    { pool, minEligible: exclN === 2 ? 2 : 1, mode: "streets" },
  );
  const freq = streetFrequencies(windowNums);
  const { color: dc, parity: dp } = dominantColorParityFromTriple(prevActive.gatilhoTriple);
  const excluded = useCriticalGatilhoExclusions
    ? pickExcludedStreetsForCriticalGatilho(
        pool,
        windowNums,
        histAtNewestFirst,
        exclN,
        prevActive.gatilhoTriple,
        dc,
        dp,
        recentCap,
        windowLen,
      )
    : pickExcludedStreetsByColdness(
        pool,
        freq,
        histAtNewestFirst,
        exclN,
        prevActive.triggerKind,
        prevActive.triggerNewerNumber,
        recentCap,
        windowLen,
        prevActive.gatilhoTriple,
      );
  const prevExcl = prevActive.excludedStreetIds;
  const changed =
    excluded.length !== prevExcl.length || excluded.some((sid, idx) => sid !== prevExcl[idx]);
  return {
    next: { ...prevActive, excludedStreetIds: excluded },
    changed,
    excluded,
  };
}

/**
 * Constrói o estado de apostas a partir do gatilho de **altura** nas posições críticas da grelha
 * (par `isStreetPairTrigger` em ordem cronológica); ficha exterior nessa metade; transversais na metade oposta;
 * exclusões pela frieza **no mesmo semicíclio** das transversais apostadas (incl. Ruas 9% com uma rua).
 */
function buildActiveFromCriticalGatilhoPrefix(
  chronological: number[],
  i: number,
  exclN: 1 | 2,
  opts?: SimulateStreetStrategyOptions,
): {
  active: StreetStrategyActive;
  critical: CriticalGatilhoArm;
  friezaLog: { windowLen: number; recentCap: number };
} | null {
  const histAtNewestFirst = [...chronological.slice(0, i + 1)].reverse();
  const gatOpts = criticalHeightOptsFromStreetOpts(opts);
  const critical = evaluateGatilhoForOpts(histAtNewestFirst, opts);
  if (!critical) return null;
  const zoneActive: ZoneIndication = critical.zone;
  const gridLabel = criticalHeightGridOrdinalLabel(
    (gatOpts?.gridIndices ?? CRITICAL_HEIGHT_DEFAULT_GRID_INDICES) as readonly [number, number],
  );
  const poolFrieza = exclusionPoolForZone(zoneActive);
  const { windowNums, recentCap, windowLen } = resolveFriezaWindowNums(
    chronological,
    i,
    histAtNewestFirst,
    { pool: [...poolFrieza], minEligible: exclN === 2 ? 2 : 1, mode: "streets" },
  );
  const excluded = pickExcludedStreetsForCriticalGatilho(
    poolFrieza,
    windowNums,
    histAtNewestFirst,
    exclN,
    critical.tripleChrono,
    critical.dominantColor,
    critical.dominantParity,
    recentCap,
    windowLen,
  );
  const poolHalfLabel = zoneActive === "19-36" ? "1–18" : "19–36";
  const m22 = critical.n22;
  const m11 = critical.n11;
  const exclText =
    exclN === 1 ? `excluir rua ${excluded[0]}` : `excluir ruas ${excluded[0]} e ${excluded[1]}`;
  const exclDetail =
    exclN === 1
      ? `exclusao pela frieza no semiciclo ${poolHalfLabel}, fora do perfil ${critical.dominantColor}/${critical.dominantParity} (uma rua sem ficha entre as apostadas)`
      : `frieza entre casas fora desse perfil na metade oposta (${poolHalfLabel})`;
  const active: StreetStrategyActive = {
    zone: zoneActive,
    excludedStreetIds: excluded,
    triggerKind: "ambos",
    triggerNewerNumber: critical.n11,
    gatilhoTriple: critical.tripleChrono,
    armingDescription: `Gatilho altura (pos. ${gridLabel}): giros ${m22}→${m11} (mais antigo primeiro), mesma metade ${critical.indicationLabel}; referencia ${critical.n11}; cor/par dominantes ${critical.dominantColor}/${critical.dominantParity}; ficha na metade ${zoneActive}; transversais no semiciclo ${poolHalfLabel}; ${exclText} (${exclDetail}).`,
  };
  return { active, critical, friezaLog: { windowLen, recentCap } };
}

function snapshotStreetStrategyActive(
  active: StreetStrategyActive | null,
): StreetStrategyActive | null {
  if (!active) return null;
  const ex = active.excludedStreetIds;
  return {
    zone: active.zone,
    excludedStreetIds: ex.length === 1 ? ([ex[0]] as const) : ([ex[0], ex[1]] as const),
    triggerKind: active.triggerKind,
    triggerNewerNumber: active.triggerNewerNumber,
    gatilhoTriple: active.gatilhoTriple,
    armingDescription: active.armingDescription,
  };
}

type ChronologicalScanResult = {
  finalActive: StreetStrategyActive | null;
  log: string[];
  /** Apos processar `chronological[i]`; indice alinhado ao placar (ativo antes do giro i+1). */
  activeAfterPrefix: (StreetStrategyActive | null)[] | null;
};

/**
 * Percorre o historico do mais antigo ao mais recente e aplica gatilhos + persistencia.
 *
 * **Gatilho 1 (classico):** tres giros **A→B→C** (mais antigo → mais recente): par **B→C** (metade+cor ou metade+paridade);
 * **A** na **mesma metade** que o par; senao **nao arma**. Com `gatilho1PairOnly`, basta o par **B→C** (dois giros).
 * Zona = metade do **C** (ou metade invertida se `invertIndicationHalf`); continuacao: novo par consecutivo na zona.
 *
 * **Frieza** nas ruas do semicíclio das transversais apostadas (janela `resolveFriezaWindowNums`).
 * Com indicacao ativa, novos gatilhos sao ignorados ate desativar. **Zero:** derrota no placar e desativa.
 *
 * Um passe cronologico: O(n). `activeAfterPrefix[i]` = estado apos o giro i (para placar usar [k-1] antes do giro k).
 */
function runChronologicalStreetSimulation(
  chronological: number[],
  opts: SimulateStreetStrategyOptions | undefined,
  captureSnapshots: boolean,
): ChronologicalScanResult {
  const exclN = opts?.exclusionStreetCount ?? 2;
  const log: string[] = [];
  let active: StreetStrategyActive | null = null;
  const n = chronological.length;
  const activeAfterPrefix: (StreetStrategyActive | null)[] | null = captureSnapshots
    ? new Array(n)
    : null;

  void criticalHeightOptsFromStreetOpts; // helpers internos: evaluateGatilhoForOpts / liveGatilhoSupportsZoneForOpts
  const critPosLabel = criticalHeightGridOrdinalLabel(
    (opts?.criticalHeightGridIndices ?? CRITICAL_HEIGHT_DEFAULT_GRID_INDICES) as readonly [
      number,
      number,
    ],
  );
  const mirrorCritConfIdx =
    (opts?.criticalHeightGridIndices ?? MIRROR_CONFIRMATION_HISTORY_INDICES) as readonly [
      number,
      number,
    ];

  for (let i = 0; i < n; i++) {
    const num = chronological[i]!;

    try {
    if (active) {
      if (num === 0) {
          log.push(`Giro ${num}: zero — derrota no placar; indicacao desativada.`);
        active = null;
        continue;
      }
        if (i < 1) {
          log.push(
            `Giro ${num}: indicacao ativa sem giro anterior no historial — indicacao desativada.`,
          );
          active = null;
          continue;
        }
        const prevNum = chronological[i - 1]!;

        if (!isStreetPairTrigger(prevNum, num)) {
          log.push(
            `Giro ${num}: falta nova formacao de par (metade+cor ou metade+paridade; Baixo 1–18 / Alto 19–36) com o giro anterior (${prevNum}) — indicacao desativada.`,
          );
          active = null;
          continue;
        }
        if (opts?.twoFactorMode) {
          const tf = evaluateTwoFactorRound(num, active);
          if (tf === "double-win") {
            log.push(
              `Dois fatores (${num}): vitoria dupla (metade ${active.zone} e segundo factor) — indicacao encerrada.`,
            );
            active = null;
            continue;
          }
          if (tf === "double-loss") {
            log.push(`Dois fatores (${num}): derrota dupla — indicacao encerrada.`);
            active = null;
            continue;
          }
        } else {
      if (active.zone === "19-36" && heightOf(num) !== "Alto") {
        log.push(
              `Giro ${num} (${heightOf(num) === "Baixo" ? "Baixo 1–18" : "?"}): fora da zona Alto (19–36) — desativada.`,
        );
        active = null;
        continue;
      }
      if (active.zone === "1-18" && heightOf(num) !== "Baixo") {
            log.push(`Giro ${num} (Alto 19–36): fora da zona Baixo (1–18) — desativada.`);
        active = null;
        continue;
      }
        }
        const exclCount: 1 | 2 = exclN === 1 ? 1 : 2;
        const { next, changed, excluded } = recomputeActiveExclusions(
          active,
          i,
          chronological,
          exclCount,
          opts?.mirrorHeightIndication === true,
        );
        active = next;
        if (opts?.mirrorHeightIndication === true && active) {
          const hnfMirror = [...chronological.slice(0, i + 1)].reverse();
          if (!liveGatilhoSupportsZoneForOpts(hnfMirror, active.zone, opts)) {
            log.push(
              `Giro ${num}: gatilho de altura — os giros nas posicoes ${critPosLabel} mais recentes deixaram de estar na mesma metade (1–18 / 19–36) alinhada a zona ${active.zone} — desativada.`,
            );
            active = null;
            continue;
          }
        }
        log.push(
          changed
            ? `Giro ${num}: mantem ${next.zone}; exclusao → ${excluded.join(", ")}.`
            : `Giro ${num}: mantem indicacao ${next.zone}.`,
        );
      continue;
    }

      if (opts?.mirrorHeightIndication === true) {
        const built = buildActiveFromCriticalGatilhoPrefix(chronological, i, exclN, opts);
        if (built) {
          const histAtNewestFirst = [...chronological.slice(0, i + 1)].reverse();
          const betCells = streetBetCellNumbersFromActive(built.active);
          if (mirrorConfirmationAlignsWithBetNumbers(histAtNewestFirst, betCells, mirrorCritConfIdx)) {
            log.push(
              `Gatilho: as posicoes criticas (${critPosLabel} giro) alinham metade Baixo/Alto, fila do tapete e cor com as transversais apostadas — alerta suprimido (tendencia historica dominante).`,
            );
          } else {
            active = built.active;
            const { critical } = built;
            const zoneActive = built.active.zone;
            const poolHalfLabel = zoneActive === "19-36" ? "1–18" : "19–36";
            const { windowLen, recentCap } = built.friezaLog;
            const ex = built.active.excludedStreetIds;
            const exclText =
              exclN === 1 ? `excluir rua ${ex[0]}` : `excluir ruas ${ex[0]} e ${ex[1]}`;
            const friezaDesc = ` Exclusao: frieza no semiciclo ${poolHalfLabel} com preferencia por ruas fora do perfil ${critical.dominantColor}/${critical.dominantParity} (ultimos ${windowLen} giros; gate de ausencia nos ultimos ${recentCap} giros quando preciso).`;
            const pred9 =
              exclN === 1
                ? " Ruas 9%: em empate de score de exclusao, desempate por menor sobreposicao de factores com o triplo critico."
                : " Ruas 20%: duas ruas excluidas pelo mesmo criterio (dois patamares de alinhamento ao perfil dominante).";
            const trendAlert = alertAlignedWithDominanceForOpts(histAtNewestFirst, opts);
            const dom = recentHalfDominanceZone(histAtNewestFirst);
            const domClash = dom !== null && dom !== critical.zone;
            const fiveClash = recentShortWindowIndicationHalfInMinority(histAtNewestFirst, critical.zone);
            const twoSpinClash = !lastTwoSpinsInIndicationHalf(histAtNewestFirst, critical.zone);
            const suppressParts: string[] = [];
            if (twoSpinClash) {
              suppressParts.push(
                "os 2 giros mais recentes não estão ambos na metade do alvo (ou há zero)",
              );
            }
            if (domClash) {
              const lab =
                dom === "19-36" ? "ALTOS (19–36)" : dom === "1-18" ? "BAIXOS (1–18)" : "outra metade";
              suppressParts.push(`dominância de mesa (${lab})`);
            }
            if (fiveClash) {
              suppressParts.push(
                "maioria dos últimos 5 giros (≠0) na metade oposta à indicação (vista curta)",
              );
            }
            const suppressNote =
              !trendAlert && suppressParts.length > 0
                ? ` ${suppressParts.join("; ")} — alerta prioritário suprimido (placar e alvos pelo par nas pos. ${critPosLabel}).`
                : !trendAlert
                  ? " Tendência desfalcada — alerta prioritário suprimido (placar inalterado)."
                  : "";
            log.push(
              trendAlert
                ? `Gatilho altura: alerta ${critical.indicationLabel} (ref. ${critical.n11}; cor/par dominantes ${critical.dominantColor}/${critical.dominantParity}); zona exterior ${zoneActive}; ${exclText}.${friezaDesc}${pred9}`
                : `Gatilho altura: par critico ${critical.indicationLabel} (ref. ${critical.n11}; cor/par dominantes ${critical.dominantColor}/${critical.dominantParity}); zona exterior ${zoneActive}; ${exclText}.${friezaDesc}${pred9}${suppressNote}`,
            );
          }
        }
      } else if (i >= 1) {
        const b = chronological[i - 1]!;
        const c = num;
        const zoneClassic = zoneForTriggerPair(b, c);
        const kindClassic = streetPairTriggerKind(b, c);

        if (zoneClassic && kindClassic) {
          const pairOnly = opts?.gatilho1PairOnly === true;
          let armTriple: readonly [number, number, number] | null = null;

          if (pairOnly) {
            armTriple = i >= 2 ? ([chronological[i - 2]!, b, c] as const) : ([b, c, c] as const);
          } else if (i < 2) {
            log.push(
              `Gatilho 1: par ${b}→${c} valido, mas sao precisos 3 giros: o terceiro mais recente (mais antigo dos tres) deve estar na mesma metade Baixo/Alto que o par.`,
            );
          } else {
            const a = chronological[i - 2]!;
            if (!isStreetGatilho1ArmTriple(a, b, c)) {
              const ha = heightOf(a);
              const hb = heightOf(b);
              const halfLabel = (h: Height) =>
                h === "Alto" ? "Alto (19–36)" : h === "Baixo" ? "Baixo (1–18)" : "zero";
              log.push(
                `Gatilho 1: par ${b}→${c} valido (${halfLabel(hb)}) — sem alerta: o terceiro dos tres mais recentes (${a}, mais antigo no tempo) esta em ${halfLabel(ha)}.`,
              );
            } else {
              armTriple = [a, b, c] as const;
            }
          }

          if (armTriple !== null) {
            const [ga, gb, gc] = armTriple;
            const zoneGatilho = zoneClassic;
            const zoneActive =
              opts?.invertIndicationHalf === true
                ? oppositeZoneIndication(zoneClassic)
                : zoneClassic;
            const pool = exclusionPoolForZone(zoneActive);
            const histAtCNewestFirst = [...chronological.slice(0, i + 1)].reverse();
            const { windowNums, recentCap, windowLen } = resolveFriezaWindowNums(
              chronological,
              i,
              histAtCNewestFirst,
              { pool, minEligible: exclN === 2 ? 2 : 1, mode: "streets" },
            );
        const freq = streetFrequencies(windowNums);
            const excluded = pickExcludedStreetsByColdness(
              pool,
              freq,
              histAtCNewestFirst,
              exclN,
              kindClassic,
              c,
              recentCap,
              windowLen,
              armTriple,
            );
            const poolHalfLabel = zoneActive === "19-36" ? "1–18" : "19–36";
            const invLogTail =
              opts?.invertIndicationHalf === true
                ? ` Indicacao invertida: ficha na metade ${zoneActive} (oposta ao par em ${zoneGatilho}); transversais no semiciclo ${poolHalfLabel}.`
                : "";
            const pairOnlyRef =
              pairOnly && i < 2
                ? `Gatilho 1 (par apenas): dois giros ${gb}→${gc} (mais antigo→mais recente); nao e exigido um terceiro giro na mesma metade.`
                : pairOnly
                  ? `Gatilho 1 (par apenas): giros de referencia ${ga}→${gb}→${gc} (mais antigo primeiro); par ${gb}→${gc} valido — o giro ${ga} nao precisa de estar na mesma metade que o par para armar.`
                  : null;
            const classicArmDesc = `Gatilho 1: tres giros mais recentes ${ga}→${gb}→${gc} (mais antigo primeiro); par ${gb}→${gc} com o terceiro (${ga}) na mesma metade. Zona ${zoneClassic}.`;
            active = {
              zone: zoneActive,
              excludedStreetIds: excluded,
              triggerKind: kindClassic,
              triggerNewerNumber: c,
              gatilhoTriple: armTriple,
              armingDescription:
                opts?.invertIndicationHalf === true
                  ? pairOnly
                    ? `${pairOnlyRef} Indicacao invertida: ficha na metade ${zoneActive} (oposta a ${zoneGatilho} do par); transversais no semiciclo ${poolHalfLabel}; excluir ${exclN === 1 ? `rua ${excluded[0]}` : `ruas ${excluded[0]} e ${excluded[1]}`}.`
                    : `Gatilho 1: triplo ${ga}→${gb}→${gc} (mais antigo primeiro); par ${gb}→${gc}. Indicacao invertida: ficha na metade ${zoneActive} (oposta a ${zoneGatilho} do par); transversais no semiciclo ${poolHalfLabel}; excluir ${exclN === 1 ? `rua ${excluded[0]}` : `ruas ${excluded[0]} e ${excluded[1]}`}.`
                  : pairOnly
                    ? `${pairOnlyRef} Zona ${zoneActive}. Excluir ${exclN === 1 ? `rua ${excluded[0]}` : `ruas ${excluded[0]} e ${excluded[1]}`}.`
                    : classicArmDesc,
            };
            const exclText =
              exclN === 1
                ? `excluir rua ${excluded[0]}`
                : `excluir ruas ${excluded[0]} e ${excluded[1]}`;
            const friezaDesc = ` Exclusao: ruas mais frias no semiciclo ${poolHalfLabel} (ultimos ${windowLen} giros; gate de ausencia ultimos ${recentCap} giros quando preciso).`;
            const pred9 =
              exclN === 1
                ? pairOnly
                  ? " Ruas 9%: entre ruas empatadas na frieza, prefere-se a que tem menos factores em comum com o par B→C e (se existir) o giro antes do par."
                  : " Ruas 9%: entre ruas empatadas na frieza, prefere-se a que tem menos factores (altura, cor, paridade) em comum com o triplo do gatilho."
                : "";
            const invLog = opts?.invertIndicationHalf === true ? " [Indicacao invertida]" : "";
            const pairLog = pairOnly
              ? " [Par apenas: sem exigencia de mesma metade no giro antes do par]"
              : "";
        log.push(
              `Gatilho 1 (${triggerKindLabel(kindClassic)}): ${pairOnly ? `par ${gb}→${gc}` : `triplo ${ga}→${gb}→${gc}; par ${gb}→${gc} (metade+cor ou metade+paridade) e terceiro na mesma metade`} — alerta zona ${zoneActive}${invLog}${pairLog} (${exclText}).${friezaDesc}${pred9}${invLogTail}`,
            );
          }
        }
      }
    } finally {
      if (activeAfterPrefix) {
        activeAfterPrefix[i] = snapshotStreetStrategyActive(active);
      }
    }
  }

  return { finalActive: active, log, activeAfterPrefix };
}

/** Um passe O(n): estado ativo apos cada giro no tempo cronologico (mais antigo → mais recente). */
export function streetStrategyActiveAfterEachChronologicalPrefix(
  chronological: number[],
  opts?: SimulateStreetStrategyOptions,
): (StreetStrategyActive | null)[] {
  const { activeAfterPrefix } = runChronologicalStreetSimulation(chronological, opts, true);
  return activeAfterPrefix ?? [];
}

export function simulateStreetStrategy(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
): StreetStrategyResult {
  if (historyNewestFirst.length === 0) {
    return { active: null, log: ["Sem historico ainda."] };
  }

  const chronological = [...historyNewestFirst].reverse();
  const { finalActive: active, log } = runChronologicalStreetSimulation(chronological, opts, false);

  if (!active) {
    const h = historyNewestFirst;
    if (opts?.mirrorHeightIndication === true) {
      // (gatilho efectivo é obtido via evaluateGatilhoForOpts / alertAlignedWithDominanceForOpts)
      const posLab = criticalHeightGridOrdinalLabel(
        (opts?.criticalHeightGridIndices ?? CRITICAL_HEIGHT_DEFAULT_GRID_INDICES) as readonly [
          number,
          number,
        ],
      );
      const mirIdx =
        (opts?.criticalHeightGridIndices ?? MIRROR_CONFIRMATION_HISTORY_INDICES) as readonly [
          number,
          number,
        ];
      const pairG = evaluateGatilhoForOpts(h, opts);
      if (!pairG) {
        log.push(
          `Gatilho altura: os giros nas posicoes ${posLab} nao cumprem metade+cor ou metade+paridade (ou ha zero) — nao arma.`,
        );
      } else {
        const exclN = opts?.exclusionStreetCount ?? 2;
        const built = buildActiveFromCriticalGatilhoPrefix(
          chronological,
          chronological.length - 1,
          exclN,
          opts,
        );
        if (!built) {
          log.push(
            "Gatilho altura: par nas posicoes criticas valido, mas o estado activo nao foi construido (estado inesperado — reportar).",
          );
        } else if (
          mirrorConfirmationAlignsWithBetNumbers(
            h,
            streetBetCellNumbersFromActive(built.active),
            mirIdx,
          )
        ) {
          log.push(
            "Gatilho altura: ha padrao valido nas posicoes criticas, mas alinham tendencia com as transversais — alerta suprimido.",
          );
        } else if (!alertAlignedWithDominanceForOpts(h, opts)) {
          const dom = recentHalfDominanceZone(h);
          const domClash = dom !== null && dom !== pairG.zone;
          const fiveClash = recentShortWindowIndicationHalfInMinority(h, pairG.zone);
          const twoSpinClash = !lastTwoSpinsInIndicationHalf(h, pairG.zone);
          const parts: string[] = [];
          if (twoSpinClash) {
            parts.push("os 2 giros mais recentes nao estao ambos na metade do alvo (ou ha zero)");
          }
          if (domClash) {
            const domLabel =
              dom === "19-36" ? "ALTOS (19–36)" : dom === "1-18" ? "BAIXOS (1–18)" : "outra metade";
            parts.push(`dominancia de mesa (${domLabel})`);
          }
          if (fiveClash) {
            parts.push("maioria dos ultimos 5 giros (sem zero) na metade oposta ao sinal");
          }
          const detail =
            parts.length > 0 ? parts.join("; ") : "tendencia em desalinho com o alerta prioritario";
          log.push(
            `Gatilho altura: par nas posicoes criticas (${pairG.n22}→${pairG.n11}) com ${pairG.indicationLabel}; ${detail} — alerta prioritario suprimido; armamento e placar seguem o par critico.`,
          );
        } else {
          log.push(
            `Gatilho altura: ha metade uniforme (${pairG.indicationLabel}; ref. ${pairG.n11}; cor/par dominantes ${pairG.dominantColor}/${pairG.dominantParity}), mas a indicacao esta desactivada — verifique o ultimo giro (zero, quebra de par de continuacao, ou fora da zona exterior).`,
          );
        }
      }
    } else {
      const pairOnly = opts?.gatilho1PairOnly === true;
      if (h.length >= 3) {
        const c = h[0]!;
        const b = h[1]!;
        const a = h[2]!;
        const tripleG1 = isStreetGatilho1ArmTriple(a, b, c);
        const parts: string[] = [];
        if (!tripleG1) {
          if (!isStreetPairTrigger(b, c)) {
            parts.push(
              `Gatilho 1: o par ${b}→${c} (mais antigo→mais recente) nao e valido (metade+cor ou metade+paridade; Baixo 1–18 / Alto 19–36).`,
            );
          } else if (!pairOnly) {
            const ha = heightOf(a);
            const hb = heightOf(b);
            const hl = (x: Height) =>
              x === "Alto" ? "Alto (19–36)" : x === "Baixo" ? "Baixo (1–18)" : "zero";
            parts.push(
              `Gatilho 1: par ${b}→${c} valido (${hl(hb)}), mas o terceiro mais recente (${a}) esta em ${hl(ha)} — e obrigatorio os tres na mesma metade para armar.`,
            );
          }
        }
        if (parts.length > 0) {
          log.push(
            `Ultimos tres giros (${c} mais recente, depois ${b}, depois ${a}). ${parts.join(" ")}`,
          );
        }
      } else if (h.length >= 2) {
      const older = h[1]!;
        const newer = h[0]!;
      if (!isStreetPairTrigger(older, newer)) {
        log.push(
            `Ultimos dois giros (${newer} mais recente, ${older} antes): nao formam par de Gatilho 1 (metade+cor ou metade+paridade).`,
          );
        } else if (pairOnly) {
          log.push(
            `Ultimos dois giros (${newer} mais recente, ${older} antes): formam par valido de Gatilho 1. Nesta aba (9%) basta o par — nao e exigido um terceiro giro na mesma metade.`,
          );
        } else {
          log.push(
            `Ultimos dois giros (${newer}, ${older}) formam par valido, mas o Gatilho 1 so arma com 3 giros e o terceiro na mesma metade Baixo/Alto que o par.`,
          );
        }
      } else if (h.length === 1) {
        log.push(
          pairOnly
            ? "Sao precisos pelo menos dois giros para armar o Gatilho 1 (par metade+cor ou metade+paridade)."
            : "Sao precisos pelo menos tres giros para armar o Gatilho 1 (par + terceiro na mesma metade).",
        );
      }
    }
  }

  return { active, log: log.slice(-24) };
}

/**
 * Opções só para contagem do placar (não alteram a simulação passo a passo).
 */
export type StreetStrategyPlacarCountOptions = {
  /**
   * Indice cronológico `k` do sorteio (1 .. len-1 no loop interno).
   * Só entram vitórias/derrotas quando `k >=` este valor (útil para não retroactuar o placar).
   * Omisso = 1 (comportamento anterior: todo o histórico conta).
   */
  minChronologicalIndexInclusive?: number;
  /**
   * Quando `true`: **vitória** só se o número cair numa das transversais com ficha (ruas do sinal,
   * após exclusões); **derrota** só com **0** ou rua excluída; qualquer outro resultado **não entra**
   * no placar (nem vitória nem derrota).
   * Omisso = `false`: vitória em qualquer 1–36 que não seja rua excluída (comportamento Ruas clássico).
   */
  winOnlyWhenHitBetStreet?: boolean;
};

/**
 * Placar por ruas excluídas: com indicação ativa antes do giro, **derrota** se sair **0** ou número
 * numa transversal excluída. Com `winOnlyWhenHitBetStreet`, **vitória** só ao acertar numa rua
 * apostada (com ficha); caso contrário o giro não entra no placar.
 * Com `opts.placarBetStreetsAsDraws` (Ruas 20%), acerto numa **transversal com ficha** (não excluída) emite **D** (empate), não **W**.
 */
export function streetStrategyPlacarOutcomesByExcludedStreets(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): StreetPlacarOutcome[] {
  if (historyNewestFirst.length < 2) return [];

  const chronological = [...historyNewestFirst].reverse();
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, opts);
  const out: StreetPlacarOutcome[] = [];
  const minK = Math.max(1, countOpts?.minChronologicalIndexInclusive ?? 1);
  const winOnlyStreet = countOpts?.winOnlyWhenHitBetStreet === true;
  const streetsAsDraws = opts?.placarBetStreetsAsDraws === true;

  for (let k = 1; k < chronological.length; k++) {
    if (k < minK) continue;
    const active = snapshots[k - 1];
    if (!active) continue;

    const num = chronological[k]!;
    if (num === 0) {
      out.push("L");
      continue;
    }
    const sid = streetIdForNumber(num);
    const skip = new Set<number>(active.excludedStreetIds);
    const hitExcluded = sid !== null && skip.has(sid);
    if (hitExcluded) {
      out.push("L");
      continue;
    }
    if (streetsAsDraws && sid !== null) {
      const { streetIds } = streetBetTargetsFromActive(active);
      if (new Set(streetIds).has(sid)) {
        out.push("D");
        continue;
      }
    }
    if (winOnlyStreet) {
      const { streetIds } = streetBetTargetsFromActive(active);
      const betStreets = new Set(streetIds);
      const onBetStreet = sid !== null && betStreets.has(sid);
      if (onBetStreet) out.push("W");
      continue;
    }
    out.push("W");
  }
  return out;
}

/**
 * Serie cumulativa ao longo do placar por ruas (uma entrada por giro contabilizado em
 * `streetStrategyPlacarOutcomesByExcludedStreets`), para graficos de evolucao.
 * Entradas **D** (empate) nao incrementam vitórias nem derrotas; a percentagem usa só W+L.
 */
export type StreetPlacarEvolutionSeries = {
  cumulativeWins: number[];
  cumulativeLosses: number[];
  aproveitamentoPct: number[];
  streakCurrent: number[];
  streakMax: number[];
};

export function streetStrategyPlacarEvolutionSeries(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): StreetPlacarEvolutionSeries | null {
  const outcomes = streetStrategyPlacarOutcomesByExcludedStreets(
    historyNewestFirst,
    opts,
    countOpts,
  );
  if (outcomes.length === 0) return null;
  let w = 0;
  let l = 0;
  let run = 0;
  let best = 0;
  const cumulativeWins: number[] = [];
  const cumulativeLosses: number[] = [];
  const aproveitamentoPct: number[] = [];
  const streakCurrent: number[] = [];
  const streakMax: number[] = [];
  for (const x of outcomes) {
    if (x === "W") {
      w += 1;
      run += 1;
      best = Math.max(best, run);
    } else if (x === "L") {
      l += 1;
      run = 0;
    } else {
      run = 0;
    }
    cumulativeWins.push(w);
    cumulativeLosses.push(l);
    aproveitamentoPct.push(w + l > 0 ? (100 * w) / (w + l) : 0);
    streakCurrent.push(run);
    streakMax.push(best);
  }
  return { cumulativeWins, cumulativeLosses, aproveitamentoPct, streakCurrent, streakMax };
}

/** Contagem de vitórias (W) do placar por metade exterior vs transversais apostadas (nao exclusivas). */
export type StreetStrategyWinSplit = {
  /** W com numero na metade da caixa Baixo 1–18 / Alto 19–36 da indicacao (exclui zero). */
  winsOnOutsideHalf: number;
  /** W com numero numa das transversais cobertas (nao excluidas no semiciclo). */
  winsOnBetStreets: number;
  /** W em que as duas condicoes se verificam no mesmo giro. */
  winsBothHalfAndStreet: number;
  /** W com giro 0: no placar por ruas excluidas o 0 conta como derrota (nao entra aqui). Mantido a 0. */
  winsOnZero: number;
};

/**
 * Para cada giro contabilizado como **W** no placar por ruas excluidas (sem 0 nem rua excluida),
 * classifica se o numero caiu na **metade** apostada (`active.zone`) e/ou numa **transversal** com ficha.
 * Com `placarBetStreetsAsDraws`, acertos nas transversais com ficha sao empates no placar e **nao** entram aqui.
 * Os contadores nao sao exclusivos: `winsBothHalfAndStreet` e a interseccao.
 */
export function streetStrategyPlacarWinsSplitByExcludedStreets(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): StreetStrategyWinSplit {
  const empty: StreetStrategyWinSplit = {
    winsOnOutsideHalf: 0,
    winsOnBetStreets: 0,
    winsBothHalfAndStreet: 0,
    winsOnZero: 0,
  };
  if (historyNewestFirst.length < 2) return empty;

  const chronological = [...historyNewestFirst].reverse();
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, opts);
  const minK = Math.max(1, countOpts?.minChronologicalIndexInclusive ?? 1);
  const streetsAsDraws = opts?.placarBetStreetsAsDraws === true;

  let winsOnOutsideHalf = 0;
  let winsOnBetStreets = 0;
  let winsBothHalfAndStreet = 0;

  for (let k = 1; k < chronological.length; k++) {
    if (k < minK) continue;
    const active = snapshots[k - 1];
    if (!active) continue;

    const num = chronological[k]!;
    const sid = streetIdForNumber(num);
    const skip = new Set<number>(active.excludedStreetIds);
    const hit = sid !== null && skip.has(sid);
    if (hit) continue;
    if (num === 0) continue;

    const { streetIds, outsideZone } = streetBetTargetsFromActive(active);
    const betStreets = new Set(streetIds);
    const onStreet = sid !== null && betStreets.has(sid);
    if (streetsAsDraws && onStreet) continue;

    const inHalf =
      (outsideZone === "1-18" && num >= 1 && num <= 18) ||
      (outsideZone === "19-36" && num >= 19 && num <= 36);

    if (inHalf) winsOnOutsideHalf += 1;
    if (onStreet) winsOnBetStreets += 1;
    if (inHalf && onStreet) winsBothHalfAndStreet += 1;
  }

  return {
    winsOnOutsideHalf,
    winsOnBetStreets,
    winsBothHalfAndStreet,
    winsOnZero: 0,
  };
}

/** Derrota no placar por ruas excluidas: triplo do gatilho (quando armou) + numero do giro que perdeu. */
export type StreetStrategyLossRecord = {
  gatilhoTriple: readonly [number, number, number];
  resultado: number;
};

/**
 * Lista as ultimas `maxLosses` derrotas (L) do placar por ruas excluidas, mais recente primeiro.
 * O triplo A→B→C e o do **armamento** do Gatilho 1 dessa sessao de indicacao (mantido ate ganhar ou perder na exclusao).
 */
export function streetStrategyLastLossRecordsByExcludedStreets(
  historyNewestFirst: number[],
  opts: SimulateStreetStrategyOptions | undefined,
  maxLosses: number,
): StreetStrategyLossRecord[] {
  if (historyNewestFirst.length < 2 || maxLosses <= 0) return [];

  const chronological = [...historyNewestFirst].reverse();
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, opts);
  const losses: StreetStrategyLossRecord[] = [];

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;

    const num = chronological[k]!;
    const sid = streetIdForNumber(num);
    const skip = new Set<number>(active.excludedStreetIds);
    const hit = sid !== null && skip.has(sid);
    if (hit || num === 0) {
      losses.push({ gatilhoTriple: active.gatilhoTriple, resultado: num });
    }
  }

  return losses.slice(-maxLosses).reverse();
}

/**
 * Placar «Dois fatores»: só conta quando havia indicacao; vitória = ambos os factors ganham no mesmo giro;
 * derrota = ambos perdem; caso contrario nao entra no placar (alerta mantem-se na simulacao).
 */
export function twoFactorPlacarOutcomes(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): ("W" | "L")[] {
  if (historyNewestFirst.length < 2) return [];

  const chronological = [...historyNewestFirst].reverse();
  const tfOpts: SimulateStreetStrategyOptions = { ...opts, twoFactorMode: true };
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, tfOpts);
  const out: ("W" | "L")[] = [];
  const minK = Math.max(1, countOpts?.minChronologicalIndexInclusive ?? 1);

  for (let k = 1; k < chronological.length; k++) {
    if (k < minK) continue;
    const active = snapshots[k - 1];
    if (!active) continue;

    const num = chronological[k]!;
    const r = evaluateTwoFactorRound(num, active);
    if (r === "double-win") out.push("W");
    else if (r === "double-loss") out.push("L");
  }
  return out;
}

export function computeTwoFactorPlacar(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): { wins: number; losses: number } {
  const o = twoFactorPlacarOutcomes(historyNewestFirst, opts, countOpts);
  let wins = 0;
  let losses = 0;
  for (const x of o) {
    if (x === "W") wins += 1;
    else losses += 1;
  }
  return { wins, losses };
}

/** Métricas de sequências no placar: vitórias seguidas atuais (no fim do histórico) e máximo de vitórias seguidas. */
export function currentConsecutiveStreaksFromPlacarOutcomes(outcomes: readonly StreetPlacarOutcome[]): {
  consecutiveWins: number;
  maxConsecutiveWins: number;
} {
  let consecutiveWins = 0;
  let maxConsecutiveWins = 0;
  for (const o of outcomes) {
    if (o === "W") {
      consecutiveWins += 1;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    } else {
      consecutiveWins = 0;
    }
  }
  return { consecutiveWins, maxConsecutiveWins };
}

export function computeStreetStrategyPlacarByExcludedStreets(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions,
  countOpts?: StreetStrategyPlacarCountOptions,
): {
  wins: number;
  losses: number;
} {
  const o = streetStrategyPlacarOutcomesByExcludedStreets(historyNewestFirst, opts, countOpts);
  let wins = 0;
  let losses = 0;
  for (const x of o) {
    if (x === "W") wins += 1;
    else if (x === "L") losses += 1;
  }
  return { wins, losses };
}

/**
 * Placar (calculadora com os dois números frios): mesma indicação ativa, mas derrota se
 * o sorteado for exatamente um dos dois números de exibição (um por rua excluída na janela) **ou 0**.
 */
export function computeStreetStrategyPlacarByExcludedDisplayNumbers(
  historyNewestFirst: number[],
  opts?: SimulateStreetStrategyOptions & { streetCountWindow?: number },
): { wins: number; losses: number } {
  if (historyNewestFirst.length < 2) return { wins: 0, losses: 0 };

  const chronological = [...historyNewestFirst].reverse();
  let wins = 0;
  let losses = 0;

  const simOpts: SimulateStreetStrategyOptions = {};
  if (opts?.exclusionStreetCount !== undefined) {
    simOpts.exclusionStreetCount = opts.exclusionStreetCount;
  }
  const hasSimOpts = simOpts.exclusionStreetCount !== undefined;
  const displayWindowOpts =
    opts?.streetCountWindow !== undefined
      ? { streetCountWindow: opts.streetCountWindow }
      : undefined;

  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(
    chronological,
    hasSimOpts ? simOpts : undefined,
  );

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;

    const histBeforeNewestFirst = [...chronological.slice(0, k)].reverse();
    const num = chronological[k]!;
    if (num === 0) {
      losses += 1;
      continue;
    }
    const display = pickExclusionDisplayNumbers(
      active.excludedStreetIds,
      histBeforeNewestFirst,
      displayWindowOpts,
    );
    const hit = display.includes(num);
    if (hit) losses += 1;
    else wins += 1;
  }

  return { wins, losses };
}

/** @deprecated Preferir `computeStreetStrategyPlacarByExcludedStreets` (aba Ruas). */
export function computeStreetStrategyPlacar(historyNewestFirst: number[]): {
  wins: number;
  losses: number;
} {
  return computeStreetStrategyPlacarByExcludedStreets(historyNewestFirst);
}

export function streetLabel(id: number): string {
  const row = CASINO_STREETS.find((s) => s.id === id);
  if (!row) return `Rua ${id}`;
  return `Rua ${id} (${row.numbers.join(", ")})`;
}

/** Texto curto para UI (tipo de par do Gatilho 1). */
export function streetPairTriggerKindShortLabel(k: StreetPairTriggerKind): string {
  if (k === "altura-cor") return "Baixo/Alto + cor";
  if (k === "altura-paridade") return "Baixo/Alto + paridade";
  return "Baixo/Alto + cor e paridade";
}
