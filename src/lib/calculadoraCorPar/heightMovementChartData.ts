export type HeightMovementRow = {
  jogada: number;
  sequence: number;
  number: number;
  color: string;
  groupLabel: string;
};

function getNumberHeight(n: number): "baixo" | "alto" | "neutro" {
  if (n === 0) return "neutro";
  return n <= 18 ? "baixo" : "alto";
}

/**
 * Mesma série que o gráfico «Altura» da calculadora: `historyOldestFirst[0]` = mais antigo,
 * `jogada` = 1…N (cronológico).
 */
export function buildHeightMovementChartData(historyOldestFirst: readonly number[]): HeightMovementRow[] {
  const out: HeightMovementRow[] = [];
  let currentSequence = 0;
  let lastGroup: string | null = null;

  historyOldestFirst.forEach((number, index) => {
    const g = getNumberHeight(number);
    if (g === "neutro") {
      currentSequence = 0;
      /** Zero reinicia a tendência: o giro seguinte começa run-up/run-down como se fosse o primeiro da série. */
      lastGroup = null;
    } else if (lastGroup === null || lastGroup === "neutro") {
      currentSequence = g === "baixo" ? 1 : -1;
    } else if (g === lastGroup) {
      currentSequence = currentSequence > 0 ? currentSequence + 1 : currentSequence - 1;
    } else {
      currentSequence = g === "baixo" ? 1 : -1;
    }
    const color = g === "neutro" ? "#6b7280" : g === "baixo" ? "#22c55e" : "#3b82f6";
    out.push({
      jogada: index + 1,
      sequence: currentSequence,
      number,
      color,
      groupLabel: g === "baixo" ? "Bai" : g === "alto" ? "Alt" : "0",
    });
    if (g !== "neutro") lastGroup = g;
  });

  return out;
}
