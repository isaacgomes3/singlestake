export type ColorMovementRow = {
  jogada: number;
  sequence: number;
  number: number;
  color: string;
  groupLabel: string;
};

function getNumberColor(n: number): "vermelho" | "preto" | "neutro" {
  if (n === 0) return "neutro";
  const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return red.includes(n) ? "vermelho" : "preto";
}

/**
 * Mesma série que o gráfico «Cor» da calculadora: `historyOldestFirst[0]` = mais antigo,
 * `jogada` = 1…N (cronológico). Zero reinicia a tendência (igual ao painel React).
 */
export function buildColorMovementChartData(historyOldestFirst: readonly number[]): ColorMovementRow[] {
  const out: ColorMovementRow[] = [];
  let currentSequence = 0;
  let lastGroup: string | null = null;

  historyOldestFirst.forEach((number, index) => {
    const g = getNumberColor(number);
    if (g === "neutro") {
      currentSequence = 0;
      lastGroup = null;
    } else if (lastGroup === null || lastGroup === "neutro") {
      currentSequence = g === "vermelho" ? 1 : -1;
    } else if (g === lastGroup) {
      currentSequence = currentSequence > 0 ? currentSequence + 1 : currentSequence - 1;
    } else {
      currentSequence = g === "vermelho" ? 1 : -1;
    }
    const color = g === "neutro" ? "#6b7280" : g === "vermelho" ? "#dc2626" : "#9ca3af";
    out.push({
      jogada: index + 1,
      sequence: currentSequence,
      number,
      color,
      groupLabel: g === "vermelho" ? "V" : g === "preto" ? "P" : "0",
    });
    if (g !== "neutro") lastGroup = g;
  });

  return out;
}
