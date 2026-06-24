import { flushSync } from "react-dom";

/**
 * `mirrorNewestFirst[0]` = giro mais recente. A calculadora cor/altura usa ordem **cronológica**
 * (índice 0 = mais antigo).
 */
export function espelhoMirrorToChronological(mirrorNewestFirst: readonly number[]): number[] {
  return [...mirrorNewestFirst].reverse();
}

function runFlushed(fn: () => void): void {
  flushSync(fn);
}

/**
 * Sincroniza o histórico cronológico da calculadora com o espelho (API/SSE + localStorage).
 * Usa `flushSync` em cada passo para o estado do alerta combinado (`useCombinedAlerts`) avançar
 * em sintonia com o histórico (evita indicação de aposta invisível após vários `addNumber` na mesma tarefa).
 */
export function syncChronologicalFromMirror(
  mirrorNewestFirst: readonly number[],
  currentChronological: readonly number[],
  clearAll: () => void,
  addNumber: (n: number, options?: { skipToasts?: boolean }) => void,
): void {
  const chrono = espelhoMirrorToChronological(mirrorNewestFirst);
  const h = currentChronological;

  if (chrono.length === 0) {
    if (h.length > 0) runFlushed(() => clearAll());
    return;
  }

  if (h.length === chrono.length) {
    let same = true;
    for (let i = 0; i < h.length; i++) {
      if (h[i] !== chrono[i]) {
        same = false;
        break;
      }
    }
    if (same) return;
  }

  if (h.length === 0) {
    for (let i = 0; i < chrono.length; i++) {
      const isLast = i === chrono.length - 1;
      runFlushed(() => addNumber(chrono[i]!, { skipToasts: !isLast }));
    }
    return;
  }

  let common = 0;
  const min = Math.min(h.length, chrono.length);
  while (common < min && h[common] === chrono[common]) common++;

  if (common === h.length && chrono.length > h.length) {
    for (let j = h.length; j < chrono.length; j++) {
      const isLast = j === chrono.length - 1;
      runFlushed(() => addNumber(chrono[j]!, { skipToasts: !isLast }));
    }
    return;
  }

  runFlushed(() => clearAll());
  for (let i = 0; i < chrono.length; i++) {
    const isLast = i === chrono.length - 1;
    runFlushed(() => addNumber(chrono[i]!, { skipToasts: !isLast }));
  }
}
