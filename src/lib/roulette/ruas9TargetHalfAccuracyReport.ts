import { buildRuas9PctStreetOptsAutoCritical } from "@/lib/roulette/ruas9PctAutoCritical";
import {
  streetStrategyActiveAfterEachChronologicalPrefix,
  type ZoneIndication,
} from "@/lib/roulette/streetStrategy";

export type Ruas9TargetHalfAccuracyBucket = {
  hits: number;
  misses: number;
  decided: number;
  /** 0–100 ou `null` se não houver acertos+erros. */
  pct: number | null;
};

export type Ruas9TargetHalfAccuracyStats = {
  /** Giros com indicação activa (entram na contagem). */
  indications: number;
  /** Quando a metade alvo foi Baixo (1–18). */
  baixo: Ruas9TargetHalfAccuracyBucket;
  /** Quando a metade alvo foi Alto (19–36). */
  alto: Ruas9TargetHalfAccuracyBucket;
  /** Todos os giros com indicação, independentemente da metade alvo. */
  combined: Ruas9TargetHalfAccuracyBucket;
};

export type Ruas9TargetHalfTableRow = Ruas9TargetHalfAccuracyStats & {
  tableId: number;
};

function emptyBucket(): Ruas9TargetHalfAccuracyBucket {
  return { hits: 0, misses: 0, decided: 0, pct: null };
}

function finalizeBucket(raw: { hits: number; misses: number }): Ruas9TargetHalfAccuracyBucket {
  const decided = raw.hits + raw.misses;
  return {
    hits: raw.hits,
    misses: raw.misses,
    decided,
    pct: decided > 0 ? (100 * raw.hits) / decided : null,
  };
}

/** Acerto na ficha exterior da metade indicada (zero = erro), alinhado a `evaluateTwoFactorRound`. */
export function spinHitsRuas9TargetHalf(num: number, zone: ZoneIndication): boolean {
  if (num === 0) return false;
  return zone === "1-18" ? num <= 18 : num >= 19;
}

export function ruas9TargetHalfZoneLabel(zone: ZoneIndication): string {
  return zone === "1-18" ? "Baixo (1–18)" : "Alto (19–36)";
}

/**
 * Acertividade da **metade alvo** (`active.zone`) em cada giro com indicação Ruas 9% activa.
 * Usa as mesmas opções e sticky key que o placar da mesa (ex.: `lobby-ruas9-{tableId}`).
 */
export function ruas9TargetHalfAccuracyFromHistory(
  historyNewestFirst: readonly number[],
  stickyKey?: string,
): Ruas9TargetHalfAccuracyStats {
  if (historyNewestFirst.length < 2) {
    return {
      indications: 0,
      baixo: emptyBucket(),
      alto: emptyBucket(),
      combined: emptyBucket(),
    };
  }

  const chronological = [...historyNewestFirst].reverse();
  const opts = buildRuas9PctStreetOptsAutoCritical(historyNewestFirst, stickyKey);
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, opts);

  const baixo = { hits: 0, misses: 0 };
  const alto = { hits: 0, misses: 0 };

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;

    const num = chronological[k]!;
    const hit = spinHitsRuas9TargetHalf(num, active.zone);
    const bucket = active.zone === "1-18" ? baixo : alto;
    if (hit) bucket.hits += 1;
    else bucket.misses += 1;
  }

  const combined = {
    hits: baixo.hits + alto.hits,
    misses: baixo.misses + alto.misses,
  };

  return {
    indications: combined.hits + combined.misses,
    baixo: finalizeBucket(baixo),
    alto: finalizeBucket(alto),
    combined: finalizeBucket(combined),
  };
}

/** Relatório por mesa (histórico completo de cada roleta). */
export function ruas9TargetHalfAccuracyReportForTables(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  stickyKey: (tableId: number) => string = (id) => `lobby-ruas9-${id}`,
): Ruas9TargetHalfTableRow[] {
  return tableIds.map((tableId) => ({
    tableId,
    ...ruas9TargetHalfAccuracyFromHistory(histories[tableId] ?? [], stickyKey(tableId)),
  }));
}
