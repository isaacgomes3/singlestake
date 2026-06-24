import {
  doisFatoresExteriorCellKey,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";

/** Chave estável para apostas exteriores (Pragmatic / European roulette). */
export type PragmaticExteriorBetKey = ReturnType<typeof doisFatoresExteriorCellKey>;

export const PRAGMATIC_EXTERIOR_BET_KEYS: readonly PragmaticExteriorBetKey[] = [
  "odd",
  "even",
  "red",
  "black",
  "low",
  "high",
] as const;

export type PragmaticExteriorBetProfile = {
  key: PragmaticExteriorBetKey;
  /** Rótulo PT na nossa app */
  appLabel: string;
  /** Textos prováveis no cliente Pragmatic (PT / EN) */
  textHints: readonly string[];
  /** Valores em data-* comuns */
  dataHints: readonly string[];
  /** Fragmentos de className */
  classHints: readonly string[];
};

export const PRAGMATIC_EXTERIOR_BET_PROFILES: Record<
  PragmaticExteriorBetKey,
  PragmaticExteriorBetProfile
> = {
  odd: {
    key: "odd",
    appLabel: "Ímpar",
    textHints: ["ímpar", "impar", "odd"],
    dataHints: ["odd", "ODD", "impar", "IMPAR"],
    classHints: ["odd", "impar"],
  },
  even: {
    key: "even",
    appLabel: "Par",
    textHints: ["par", "even"],
    dataHints: ["even", "EVEN", "par", "PAR"],
    classHints: ["even", "par"],
  },
  red: {
    key: "red",
    appLabel: "Vermelho",
    textHints: ["vermelho", "red"],
    dataHints: ["red", "RED", "vermelho"],
    classHints: ["red", "vermelho"],
  },
  black: {
    key: "black",
    appLabel: "Preto",
    textHints: ["preto", "black"],
    dataHints: ["black", "BLACK", "preto"],
    classHints: ["black", "preto"],
  },
  low: {
    key: "low",
    appLabel: "Baixo 1–18",
    textHints: ["1-18", "1–18", "baixo", "low"],
    dataHints: ["low", "LOW", "1-18", "1_18"],
    classHints: ["low", "1-18", "1_18"],
  },
  high: {
    key: "high",
    appLabel: "Alto 19–36",
    textHints: ["19-36", "19–36", "alto", "high"],
    dataHints: ["high", "HIGH", "19-36", "19_36"],
    classHints: ["high", "19-36", "19_36"],
  },
};

export function pragmaticExteriorBetKeyFromFactor(
  factor: DoisFatoresFactor,
): PragmaticExteriorBetKey {
  return doisFatoresExteriorCellKey(factor);
}

export function pragmaticExteriorBetLabel(key: PragmaticExteriorBetKey): string {
  return PRAGMATIC_EXTERIOR_BET_PROFILES[key].appLabel;
}
