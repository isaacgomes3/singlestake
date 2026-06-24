/** Histórico cronológico na calculadora: índice 0 = mais antigo, último = mais recente. */

function getNumberColor(n: number): "vermelho" | "preto" | "neutro" {
  if (n === 0) return "neutro";
  const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return red.includes(n) ? "vermelho" : "preto";
}

function getNumberHeight(n: number): "baixo" | "alto" | "neutro" {
  if (n === 0) return "neutro";
  return n <= 18 ? "baixo" : "alto";
}

export type StreakExplainLeg = {
  /** Rótulo do grupo actual (ex.: vermelho, baixo). */
  groupLabel: string;
  /** Quantos giros consecutivos com esse grupo a partir do mais recente (zero interrompe). */
  count: number;
  /** Até 14 números do sufixo da streak, mais recente primeiro. */
  sampleNewestFirst: number[];
  countMeetsAlert: boolean;
};

export type CalculadoraStreakExplain = {
  lastSpin: number | null;
  color: StreakExplainLeg;
  height: StreakExplainLeg;
  /** Igual a `analyzeSequences` em `useCombinedAlerts`: precisa de ≥2 giros no histórico. */
  motorHasMinHistory: boolean;
  /** Ambas as pernas ≥2, último giro útil em cor e altura, e histórico com ≥2 giros (alinhado a `shouldAlert`). */
  bothLegsReadyForAlert: boolean;
};

function buildStreakLeg(
  historyChronological: readonly number[],
  getGroup: (n: number) => string,
  groupLabelFor: (g: string) => string,
): StreakExplainLeg {
  if (historyChronological.length < 1) {
    return { groupLabel: "—", count: 0, sampleNewestFirst: [], countMeetsAlert: false };
  }
  const last = historyChronological[historyChronological.length - 1]!;
  const lastG = getGroup(last);
  if (lastG === "neutro") {
    return {
      groupLabel: "zero",
      count: 0,
      sampleNewestFirst: [last],
      countMeetsAlert: false,
    };
  }
  const sample: number[] = [last];
  let count = 1;
  for (let i = historyChronological.length - 2; i >= 0; i--) {
    const n = historyChronological[i]!;
    const g = getGroup(n);
    if (g === "neutro") break;
    if (g !== lastG) break;
    count++;
    if (sample.length < 14) sample.push(n);
  }
  return {
    groupLabel: groupLabelFor(lastG),
    count,
    sampleNewestFirst: sample,
    countMeetsAlert: count >= 2,
  };
}

/**
 * Explica o que a calculadora usa para o alerta combinado: duas contagens independentes
 * no **fim** do histórico cronológico (não é só «o último número» isolado).
 */
export function explainCalculadoraStreaks(
  historyChronological: readonly number[],
): CalculadoraStreakExplain {
  const lastSpin =
    historyChronological.length > 0 ? historyChronological[historyChronological.length - 1]! : null;

  const color = buildStreakLeg(historyChronological, getNumberColor, (g) =>
    g === "vermelho" ? "Vermelho" : g === "preto" ? "Preto" : g,
  );
  const height = buildStreakLeg(historyChronological, getNumberHeight, (g) =>
    g === "baixo" ? "Baixo (1–18)" : g === "alto" ? "Alto (19–36)" : g,
  );

  const lastColorG = lastSpin != null ? getNumberColor(lastSpin) : "neutro";
  const lastHeightG = lastSpin != null ? getNumberHeight(lastSpin) : "neutro";
  const motorHasMinHistory = historyChronological.length >= 2;
  const bothLegsReadyForAlert =
    motorHasMinHistory &&
    color.countMeetsAlert &&
    height.countMeetsAlert &&
    lastColorG !== "neutro" &&
    lastHeightG !== "neutro";

  return { lastSpin, color, height, motorHasMinHistory, bothLegsReadyForAlert };
}
