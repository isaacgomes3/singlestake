const KEY = "smartmove.persist.v1";

/** Estatísticas persistidas (sem simulação de banco). */
export type SmartMovePersisted = {
  version: 2;
  winsAllTime: number;
  lossesAllTime: number;
  maxGaleEver: number;
  /** Vitórias seguidas no placar Smart Move (última aposta resolvida). */
  currentConsecutiveWins: number;
  maxConsecutiveWins: number;
  /** Derrotas seguidas (última aposta resolvida). */
  currentConsecutiveLosses: number;
  maxConsecutiveLosses: number;
};

const DEFAULTS: SmartMovePersisted = {
  version: 2,
  winsAllTime: 0,
  lossesAllTime: 0,
  maxGaleEver: 0,
  currentConsecutiveWins: 0,
  maxConsecutiveWins: 0,
  currentConsecutiveLosses: 0,
  maxConsecutiveLosses: 0,
};

function clampIntNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parse(raw: string | null): SmartMovePersisted {
  if (raw == null) return { ...DEFAULTS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.version === 2 && typeof o.winsAllTime === "number" && typeof o.maxGaleEver === "number") {
      return {
        version: 2,
        winsAllTime: clampIntNonNeg(o.winsAllTime),
        lossesAllTime: clampIntNonNeg(Number(o.lossesAllTime) || 0),
        maxGaleEver: clampIntNonNeg(o.maxGaleEver),
        currentConsecutiveWins: clampIntNonNeg(Number(o.currentConsecutiveWins) || 0),
        maxConsecutiveWins: clampIntNonNeg(Number(o.maxConsecutiveWins) || 0),
        currentConsecutiveLosses: clampIntNonNeg(Number(o.currentConsecutiveLosses) || 0),
        maxConsecutiveLosses: clampIntNonNeg(Number(o.maxConsecutiveLosses) || 0),
      };
    }
    /** Migração a partir do formato antigo (v1 com banco simulado). */
    if (o.version === 1 || o.winsAllTime != null || o.maxGaleEver != null) {
      return {
        version: 2,
        winsAllTime: clampIntNonNeg(Number(o.winsAllTime) || 0),
        lossesAllTime: 0,
        maxGaleEver: clampIntNonNeg(Number(o.maxGaleEver) || 0),
        currentConsecutiveWins: 0,
        maxConsecutiveWins: 0,
        currentConsecutiveLosses: 0,
        maxConsecutiveLosses: 0,
      };
    }
    return { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadSmartMovePersisted(): SmartMovePersisted {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    return parse(window.localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSmartMovePersisted(next: SmartMovePersisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function defaultSmartMovePersisted(): SmartMovePersisted {
  return { ...DEFAULTS };
}
