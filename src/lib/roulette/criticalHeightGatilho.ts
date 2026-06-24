/**
 * Gatilho das abas espelho (Ruas 20%, Ruas 9%, Números 2,8%): nas variantes com **par** nas células críticas,
 * os dois giros de referência têm de cumprir a mesma regra que o **par de continuação** (`isStreetPairTrigger` em
 * `streetPairTrigger`): **mesma metade** (1–18 ou 19–36) **e** (mesma cor **ou** mesma paridade); zeros não armam.
 * **Ruas 20%:** posições **11** e **22** da grelha (`history[10]`, `history[21]`, newest-first).
 * **Ruas 9%:** por opção pode usar **uma** posição na grelha (`singleGridIndex` em `historyNewestFirst`);
 * o armamento usa só a **altura** desse giro (sem `isStreetPairTrigger` entre duas células). O defeito global
 * do par continua **11** e **22** (20%).
 * **Números 2,8%:** posições **11** e **12** (`history[10]`, `history[11]`).
 * Cor e paridade **dominantes** (após armar) orientam as exclusões.
 * **Tendência recente da mesa** (`recentHalfDominanceZone`: 22 giros se `length ≥ 22`, senão 5 se `5–21`;
 * janela curta dos últimos 5 para minoria do alvo; **últimos 2 giros** na metade do alvo para sinal no tapete):
 * serve **só**
 * para decidir se convém dar **destaque / alerta prioritário** — **não** altera o armamento do par
 * crítico, `liveCriticalTripleSupportsZone` nem o placar (o alvo segue o par ou a célula crítica configurada).
 * Critério do par partilhado com `isStreetPairTrigger` em `streetPairTrigger` (sem import circular com `streetStrategy`).
 */

import { colorOf, heightOf, parityOf, isStreetPairTrigger } from "@/lib/roulette/streetPairTrigger";

/** Índices na grelha 11×3 (newest-first): posições **11** e **22** — Ruas 20%. */
export const CRITICAL_HEIGHT_DEFAULT_GRID_INDICES = [10, 21] as const;

/**
 * Índice na grelha 11×3 (newest-first): posição **11** — referência estática Ruas 9% quando não há selector
 * automático (`criticalHeightSingleGridIndex`).
 */
export const RUAS_9_PCT_CRITICAL_HEIGHT_SINGLE_GRID_INDEX = 10 as const;

/** Índices na grelha 11×3 (newest-first): posições **11** e **12** — Ruas 9% (rótulos legados). */
export const RUAS_9_PCT_CRITICAL_HEIGHT_GRID_INDICES = [10, 11] as const;

/** Índices na grelha 11×3 (newest-first): posições **11** e **12** — Números 2,8% (espelho ao vivo). */
export const NUMS_28_PCT_CRITICAL_HEIGHT_GRID_INDICES = [10, 11] as const;

export type CriticalHeightGatilhoOptions = {
  /** Par de índices em `historyNewestFirst` (0 = giro mais recente). Omisso = Ruas (`[10, 21]`). */
  gridIndices?: readonly [number, number];
  /**
   * Um único índice em `historyNewestFirst`: gatilho só pela **altura** desse giro (≠0). Ignora `gridIndices`
   * quando definido. Ruas 9% (selector automático).
   */
  singleGridIndex?: number;
};

function minHistoryLengthForGridIndices(indices: readonly [number, number]): number {
  return Math.max(indices[0], indices[1]) + 1;
}

function minHistoryLengthForSingleGridIndex(i: number): number {
  return i + 1;
}

export type ZoneIndicationFromHeight = "1-18" | "19-36";

/** Com ≥ este comprimento no histórico, a dominância de mesa usa só estes giros (duas linhas 11×3). */
const RECENT_DOMINANCE_LONG_SPINS = 22;
const RECENT_DOMINANCE_LONG_MIN_NONZERO = 10;
const RECENT_DOMINANCE_LONG_MARGIN = 3;

/** Histórico com menos de 22 giros mas ≥ 5: usa-se só este prefixo (recorte curto). */
const RECENT_DOMINANCE_SHORT_SPINS = 5;
const RECENT_DOMINANCE_SHORT_MIN_NONZERO = 3;
const RECENT_DOMINANCE_SHORT_MARGIN = 2;

/**
 * Metade do tapete que **domina** os giros recentes (1–18 vs 19–36), ou `null` se equilibrado / poucos dados.
 * Zeros são ignorados na contagem.
 *
 * - Com **≥ 22** giros (newest-first): usa-se **só** a janela dos **22** mais recentes (≈ duas linhas da grelha),
 *   mínimo **10** giros ≠ 0 e margem **≥ +3** numa das metades. Evita alertas alinhados só aos últimos 5 quando
 *   o «quadro» dos 22 ainda favorece a metade oposta.
 * - Com **5 a 21** giros: usa-se **só** a janela dos **5** mais recentes; mínimo **3** ≠ 0 e margem **≥ +2**.
 * - Com **menos de 5** giros: `null`.
 */
export function recentHalfDominanceZone(
  historyNewestFirst: readonly number[],
): ZoneIndicationFromHeight | null {
  const countInPrefix = (maxSpin: number) => {
    let lo = 0;
    let hi = 0;
    const lim = Math.min(historyNewestFirst.length, maxSpin);
    for (let i = 0; i < lim; i++) {
      const n = historyNewestFirst[i]!;
      if (n === 0) continue;
      if (n <= 18) lo += 1;
      else hi += 1;
    }
    return { lo, hi, t: lo + hi };
  };

  if (historyNewestFirst.length >= RECENT_DOMINANCE_LONG_SPINS) {
    const w = countInPrefix(RECENT_DOMINANCE_LONG_SPINS);
    if (w.t >= RECENT_DOMINANCE_LONG_MIN_NONZERO) {
      if (w.hi >= w.lo + RECENT_DOMINANCE_LONG_MARGIN) return "19-36";
      if (w.lo >= w.hi + RECENT_DOMINANCE_LONG_MARGIN) return "1-18";
    }
    return null;
  }

  if (historyNewestFirst.length < RECENT_DOMINANCE_SHORT_SPINS) return null;

  const w = countInPrefix(RECENT_DOMINANCE_SHORT_SPINS);
  if (w.t < RECENT_DOMINANCE_SHORT_MIN_NONZERO) return null;
  if (w.hi >= w.lo + RECENT_DOMINANCE_SHORT_MARGIN) return "19-36";
  if (w.lo >= w.hi + RECENT_DOMINANCE_SHORT_MARGIN) return "1-18";
  return null;
}

/** Giros visíveis na 1.ª linha da grelha (alinhado ao painel de aprendizado / últimos 5). */
const ALERT_SHORT_WINDOW_SPINS = 5;

export type ShortWindowHalfCounts = {
  /** Giros ≠0 considerados na janela. */
  nz: number;
  /** Quantos caem na metade da indicação `zone`. */
  inZone: number;
  /** `nz - inZone` (metade oposta). */
  opposite: number;
};

/**
 * Conta quantos dos `maxSpins` giros mais recentes (newest-first) caem na metade da `zone` vs a oposta;
 * **zeros não entram** na contagem.
 */
export function recentShortWindowHalfCounts(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
  maxSpins: number = ALERT_SHORT_WINDOW_SPINS,
): ShortWindowHalfCounts {
  let nz = 0;
  let inZone = 0;
  const lim = Math.min(maxSpins, historyNewestFirst.length);
  for (let i = 0; i < lim; i++) {
    const n = historyNewestFirst[i]!;
    if (n === 0) continue;
    nz += 1;
    const isHigh = n >= 19;
    const inTarget = zone === "19-36" ? isHigh : !isHigh;
    if (inTarget) inZone += 1;
  }
  return { nz, inZone, opposite: nz - inZone };
}

/**
 * A metade da **indicação** (`zone`) está em **minoria estrita** entre os últimos giros ≠0 da janela
 * (equivalente a maioria estrita na metade oposta). Ex.: alvo Baixo e 4 Altos em 5 giros com dados.
 * Só para **suprimir alerta prioritário**; não afecta armamento nem placar.
 */
export function recentShortWindowIndicationHalfInMinority(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
  maxSpins: number = ALERT_SHORT_WINDOW_SPINS,
): boolean {
  const { nz, inZone } = recentShortWindowHalfCounts(historyNewestFirst, zone, maxSpins);
  if (nz < 2) return false;
  return inZone * 2 < nz;
}

/**
 * Maioria estrita na metade **oposta** a `zone` (alias da regra de minoria do alvo; mantido por nome legível).
 */
export function recentShortWindowMajorityOpposesHalf(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
  maxSpins: number = ALERT_SHORT_WINDOW_SPINS,
): boolean {
  return recentShortWindowIndicationHalfInMinority(historyNewestFirst, zone, maxSpins);
}

export type CriticalGatilhoArm = {
  /** Giro na célula **mais recente** do par crítico (menor índice no histórico newest-first). */
  n11: number;
  /** Giro na célula **mais antiga** do par crítico (maior índice). No modo altura única, repete `n11`. */
  n22: number;
  /**
   * Compatível com código que esperava três entradas: `[n22, n11, n11]` (cronológico mais antigo → mais recente).
   * O terceiro valor repete `n11` só para manter assinatura; a lógica usa apenas os dois giros críticos.
   * Modo altura única: `[n, n, n]`.
   */
  tripleChrono: readonly [number, number, number];
  zone: ZoneIndicationFromHeight;
  dominantColor: "Vermelho" | "Preto";
  dominantParity: "Par" | "Impar";
  indicationLabel: string;
  /** Ausente ou `"pair"` = par clássico; `"single"` = uma só célula (altura). */
  criticalTriggerKind?: "pair" | "single";
};

function dominantColorAmongThree(a: number, b: number, c: number): "Vermelho" | "Preto" {
  let v = 0;
  let p = 0;
  for (const n of [a, b, c]) {
    const col = colorOf(n);
    if (col === "Vermelho") v++;
    else if (col === "Preto") p++;
  }
  return v >= p ? "Vermelho" : "Preto";
}

function dominantParityAmongThree(a: number, b: number, c: number): "Par" | "Impar" {
  let e = 0;
  let o = 0;
  for (const n of [a, b, c]) {
    const par = parityOf(n);
    if (par === "Par") e++;
    else if (par === "Impar") o++;
  }
  return e >= o ? "Par" : "Impar";
}

/**
 * Um giro na posição crítica (≠0): **armamento** só pela **altura** — sem `isStreetPairTrigger` entre duas células.
 */
export function evaluateCriticalHeightSingleArmed(
  historyNewestFirst: readonly number[],
  singleGridIndex: number,
): CriticalGatilhoArm | null {
  if (singleGridIndex < 0) return null;
  const minLen = minHistoryLengthForSingleGridIndex(singleGridIndex);
  if (historyNewestFirst.length < minLen) return null;
  const n = historyNewestFirst[singleGridIndex]!;
  if (n === 0) return null;
  const h = heightOf(n);
  if (h === "Zero") return null;
  const zone: ZoneIndicationFromHeight = h === "Alto" ? "19-36" : "1-18";
  const dominantColor = dominantColorAmongThree(n, n, n);
  const dominantParity = dominantParityAmongThree(n, n, n);
  const indicationLabel = zone === "1-18" ? "BAIXO (1–18)" : "ALTO (19–36)";
  return {
    n11: n,
    n22: n,
    tripleChrono: [n, n, n],
    zone,
    dominantColor,
    dominantParity,
    indicationLabel,
    criticalTriggerKind: "single",
  };
}

/**
 * Par nas células críticas válido (metade + cor ou paridade) — critério de **armamento** Ruas 20% / Números 2,8%.
 * Com `options.singleGridIndex`, delega a `evaluateCriticalHeightSingleArmed` (Ruas 9% altura única).
 */
export function evaluateCriticalHeightPairArmed(
  historyNewestFirst: readonly number[],
  options?: CriticalHeightGatilhoOptions,
): CriticalGatilhoArm | null {
  if (options?.singleGridIndex !== undefined) {
    return evaluateCriticalHeightSingleArmed(historyNewestFirst, options.singleGridIndex);
  }
  const gridIndices = options?.gridIndices ?? CRITICAL_HEIGHT_DEFAULT_GRID_INDICES;
  const minLen = minHistoryLengthForGridIndices(gridIndices);
  if (historyNewestFirst.length < minLen) return null;
  const iRecent = Math.min(gridIndices[0], gridIndices[1]);
  const iOlder = Math.max(gridIndices[0], gridIndices[1]);
  const n11 = historyNewestFirst[iRecent]!;
  const n22 = historyNewestFirst[iOlder]!;
  if (n11 === 0 || n22 === 0) return null;
  if (!isStreetPairTrigger(n22, n11)) return null;
  const h11 = heightOf(n11);
  const zone: ZoneIndicationFromHeight = h11 === "Alto" ? "19-36" : "1-18";
  const dominantColor = dominantColorAmongThree(n11, n11, n22);
  const dominantParity = dominantParityAmongThree(n11, n11, n22);
  const indicationLabel = zone === "1-18" ? "BAIXO (1–18)" : "ALTO (19–36)";
  return {
    n11,
    n22,
    tripleChrono: [n22, n11, n11],
    zone,
    dominantColor,
    dominantParity,
    indicationLabel,
    criticalTriggerKind: "pair",
  };
}

/**
 * Alias de `evaluateCriticalHeightPairArmed` (nome histórico no projecto). O armamento **não** depende
 * da dominância recente; para aviso alinhado à tendência use `criticalHeightAlertAlignedWithRecentDominance`.
 */
export function evaluateCriticalHeightGatilho(
  historyNewestFirst: readonly number[],
  options?: CriticalHeightGatilhoOptions,
): CriticalGatilhoArm | null {
  return evaluateCriticalHeightPairArmed(historyNewestFirst, options);
}

/**
 * Os dois giros mais recentes (`history[0]`, `history[1]`, newest-first) estão **ambos** na metade da
 * indicação `zone` (1–18 ou 19–36). Zeros **não** contam — qualquer zero faz falhar o teste.
 * Usado para **só** mostrar o sinal no tapete / alerta prioritário quando o fluxo recente confirma o alvo.
 */
export function lastTwoSpinsInIndicationHalf(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
): boolean {
  if (historyNewestFirst.length < 2) return false;
  const a = historyNewestFirst[0]!;
  const b = historyNewestFirst[1]!;
  if (a === 0 || b === 0) return false;
  const inZone = (n: number) => (zone === "1-18" ? n <= 18 : n >= 19);
  return inZone(a) && inZone(b);
}

/**
 * `true` quando existe par crítico válido **e** a tendência recente **não** desaconselha o alerta prioritário:
 * os **dois** giros mais recentes na metade do alvo (`lastTwoSpinsInIndicationHalf`), **e** metade dominante
 * (`recentHalfDominanceZone`) alinhada ou ausente, **e** a metade da indicação **não** está em minoria estrita
 * nos últimos 5 giros ≠ 0 (`recentShortWindowIndicationHalfInMinority`).
 * `false` → suprimir alerta (placar e alvos inalterados).
 */
export function criticalHeightAlertAlignedWithRecentDominance(
  historyNewestFirst: readonly number[],
  options?: CriticalHeightGatilhoOptions,
): boolean {
  const arm = evaluateCriticalHeightPairArmed(historyNewestFirst, options);
  if (!arm) return false;
  if (!lastTwoSpinsInIndicationHalf(historyNewestFirst, arm.zone)) return false;
  const dom = recentHalfDominanceZone(historyNewestFirst);
  if (dom !== null && dom !== arm.zone) return false;
  if (recentShortWindowIndicationHalfInMinority(historyNewestFirst, arm.zone)) return false;
  return true;
}

/**
 * Com indicação activa: o gatilho de altura (par ou posição única) continua a indicar a **mesma** metade
 * que a `zone` da indicação (sem filtro de dominância da mesa).
 */
export function liveCriticalTripleSupportsZone(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
  options?: CriticalHeightGatilhoOptions,
): boolean {
  const g = evaluateCriticalHeightPairArmed(historyNewestFirst, options);
  return g !== null && g.zone === zone;
}

/** Cor e paridade majoritárias entre os dois giros críticos (compat.: triplo pode repetir o giro mais recente). */
export function dominantColorParityFromTriple(triple: readonly [number, number, number]): {
  color: "Vermelho" | "Preto";
  parity: "Par" | "Impar";
} {
  const [a, b, c] = triple;
  return {
    color: dominantColorAmongThree(a, b, c),
    parity: dominantParityAmongThree(a, b, c),
  };
}
