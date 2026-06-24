/**
 * Detecção da sequência espelhada (últimos N vs N consecutivos opostos na timeline).
 * Módulo autónomo: não importa `streetStrategy` para evitar dependência circular
 * quando a simulação de ruas reutiliza esta lógica.
 */

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type MirrorColor = "Vermelho" | "Preto" | "Zero";
type MirrorHeight = "Baixo" | "Alto" | "Zero";
type MirrorParity = "Par" | "Impar" | "Zero";

function colorOf(n: number): MirrorColor {
  if (n === 0) return "Zero";
  return RED.has(n) ? "Vermelho" : "Preto";
}

function heightOf(n: number): MirrorHeight {
  if (n === 0) return "Zero";
  return n <= 18 ? "Baixo" : "Alto";
}

function parityOf(n: number): MirrorParity {
  if (n === 0) return "Zero";
  return n % 2 === 0 ? "Par" : "Impar";
}

/** Cor, metade (1–18 / 19–36) e paridade — uso interno para opostos e altura do alerta. */
type EspelhoTriple = {
  color: "Vermelho" | "Preto";
  height: "Baixo" | "Alto";
  parity: "Par" | "Impar";
};

function tripleOfSpin(n: number): EspelhoTriple | null {
  if (n === 0) return null;
  const c = colorOf(n);
  const h = heightOf(n);
  const p = parityOf(n);
  if (c === "Zero" || h === "Zero" || p === "Zero") return null;
  return { color: c, height: h, parity: p };
}

/** Dois números (1–36) são opostos em cor, metade e paridade. */
export function fullyOppositeNumbers(a: number, b: number): boolean {
  const ta = tripleOfSpin(a);
  const tb = tripleOfSpin(b);
  if (!ta || !tb) return false;
  return ta.color !== tb.color && ta.height !== tb.height && ta.parity !== tb.parity;
}

/** Metade 1–18 / 19–36 (alerta Espelho). */
export type EspelhoIndicationHeight = "Baixo" | "Alto";

/** Texto do alerta só com metade do tapete. */
export function formatEspelhoHeightDisplay(h: EspelhoIndicationHeight): string {
  return h === "Baixo" ? "BAIXO (1–18)" : "ALTO (19–36)";
}

export function espelhoHeightOutsideRowKeys(height: EspelhoIndicationHeight): Set<string> {
  return new Set([height === "Baixo" ? "low" : "high"]);
}

/** Comprimento da sequência espelhada: últimos N giros vs N consecutivos opostos na timeline. */
export const ESPELHO_MIRROR_SEQUENCE_LEN = 3;

export type EspelhoState = {
  /** Últimos 3 giros, do mais antigo ao mais recente. */
  lastMirrorChrono: readonly [number, number, number];
  /** Índice na linha do tempo (cronológica) onde começa a sequência espelhada. */
  mirrorWindowStartChrono: number;
  /** Número imediatamente à esquerda da sequência espelhada na timeline. */
  alertNumber: number;
  /** Metade do tapete alertada: oposta à do número base (à esquerda da sequência). */
  indicationHeight: EspelhoIndicationHeight;
  indicationLabel: string;
};

/**
 * Usa os últimos `ESPELHO_MIRROR_SEQUENCE_LEN` números (mais recente no índice 0 do histórico).
 * Procura na timeline (antigo → recente) uma janela de N consecutivos,
 * cada um oposto ao correspondente dos N últimos, na mesma ordem.
 * O alerta é a **metade contrária** (1–18 vs 19–36) à do número imediatamente à esquerda dessa janela.
 */
export function computeEspelhoState(historyNewestFirst: number[]): EspelhoState | null {
  const L = ESPELHO_MIRROR_SEQUENCE_LEN;
  if (historyNewestFirst.length < L) return null;
  const a0 = historyNewestFirst[L - 1]!;
  const a1 = historyNewestFirst[L - 2]!;
  const a2 = historyNewestFirst[L - 3]!;
  const lastMirrorChrono: readonly [number, number, number] = [a0, a1, a2];
  if (lastMirrorChrono.some((x) => x === 0)) return null;

  const chrono = [...historyNewestFirst].reverse();
  const n = chrono.length;
  for (let s = n - L; s >= 1; s -= 1) {
    if (
      fullyOppositeNumbers(chrono[s]!, a0) &&
      fullyOppositeNumbers(chrono[s + 1]!, a1) &&
      fullyOppositeNumbers(chrono[s + 2]!, a2)
    ) {
      const alertNumber = chrono[s - 1]!;
      if (alertNumber === 0) continue;
      const t = tripleOfSpin(alertNumber);
      if (!t) continue;
      const indicationHeight: EspelhoIndicationHeight = t.height === "Baixo" ? "Alto" : "Baixo";
      return {
        lastMirrorChrono,
        mirrorWindowStartChrono: s,
        alertNumber,
        indicationHeight,
        indicationLabel: formatEspelhoHeightDisplay(indicationHeight),
      };
    }
  }
  return null;
}
