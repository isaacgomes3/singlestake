import { smartMoveGroupForNumber } from "@/lib/smartMove/groups";

export type SmartMoveHeight = "low" | "high";

export type SmartMoveAlert =
  | {
      height: SmartMoveHeight;
      label: string;
      targetNumbers: readonly number[];
    }
  | null;

/**
 * Grelha 11×3 (padrão do sistema): `history[0]` = mais recente no canto superior esquerdo, leitura em linhas.
 * Posições **1-based** 11 e 22 ⇔ índices no histórico newest-first **10** e **21**.
 */
export const SMART_MOVE_GRID_HISTORY_INDICES = [10, 21] as const;

/** Mínimo de giros para existir a célula da pos. 22 (índice 21). */
export const SMART_MOVE_CONVERGENCE_MIN_HISTORY = 22;

/** Cobertura quando a indicação é **Baixo**. */
export const SMART_MOVE_BAIXO_TARGET_NUMBERS: readonly number[] = Object.freeze(
  Array.from({ length: 18 }, (_, i) => i + 1),
);

/** Cobertura quando a indicação é **Alto**. */
export const SMART_MOVE_ALTO_TARGET_NUMBERS: readonly number[] = Object.freeze(
  Array.from({ length: 18 }, (_, i) => i + 19),
);

function heightBand(n: number): SmartMoveHeight | null {
  if (n === 0) return null;
  if (n >= 1 && n <= 18) return "low";
  if (n >= 19 && n <= 36) return "high";
  return null;
}

/**
 * Posições 11 e 22, **mesmo grupo** Smart Move (rosa/azul) e **mesma altura** (Baixo ou Alto).
 */
export function detectSmartMoveConvergence(historyNewestFirst: readonly number[]): SmartMoveAlert {
  if (historyNewestFirst.length < SMART_MOVE_CONVERGENCE_MIN_HISTORY) return null;
  const a = historyNewestFirst[SMART_MOVE_GRID_HISTORY_INDICES[0]]!;
  const b = historyNewestFirst[SMART_MOVE_GRID_HISTORY_INDICES[1]]!;
  const ga = smartMoveGroupForNumber(a);
  const gb = smartMoveGroupForNumber(b);
  if (ga == null || gb == null || ga !== gb) return null;

  const ha = heightBand(a);
  const hb = heightBand(b);
  if (ha == null || hb == null || ha !== hb) return null;

  if (ha === "low") {
    return {
      height: "low",
      label: "Indicação: Baixo (1–18)",
      targetNumbers: SMART_MOVE_BAIXO_TARGET_NUMBERS,
    };
  }
  return {
    height: "high",
    label: "Indicação: Alto (19–36)",
    targetNumbers: SMART_MOVE_ALTO_TARGET_NUMBERS,
  };
}
