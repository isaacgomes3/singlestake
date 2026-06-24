/**
 * Estratégia **Ruas 25%** (mesa ao vivo):
 * - A roda europeia (sem zero) divide-se em **4 grupos** de 9 números — arcos no cilindro:
 *   32→34 · 6→10 · 5→9 · 22→26.
 * - Identifica o grupo com **mais giros sem aparecer** (qualquer número do grupo).
 * - **Exclusão:** os **dois números mais frios** dentro desse grupo (maior ausência individual).
 * - **Gatilho:** só alerta se o **último giro** (1–36) cair no grupo **oposto** no cilindro (1↔3, 2↔4).
 *   Zero ou grupos vizinhos → sem indicação.
 * - Placar: **W** se o giro não cair nos excluídos; **L** se cair; **0** conta como **W**.
 */

import { wheelArcNumbersClockwise } from "@/lib/roulette/cylinderIndication";
import { spinsSinceHit, twoColdestNumbersInNumberSet } from "@/lib/roulette/liveTableColdStats";
import type { StreetPlacarEvolutionSeries } from "@/lib/roulette/streetStrategy";

export const RUAS_25_PCT_STRATEGY_DISPLAY_NAME = "Ruas 25%";

export type Ruas25WheelGroupId = 1 | 2 | 3 | 4;

export type Ruas25WheelGroup = {
  id: Ruas25WheelGroupId;
  label: string;
  numbers: readonly number[];
};

/** Quatro sectores fixos no anel físico europeu (sentido horário, sem o zero). */
export const RUAS_25_WHEEL_GROUPS: readonly Ruas25WheelGroup[] = [
  { id: 1, label: "32→34", numbers: wheelArcNumbersClockwise(32, 34) },
  { id: 2, label: "6→10", numbers: wheelArcNumbersClockwise(6, 10) },
  { id: 3, label: "5→9", numbers: wheelArcNumbersClockwise(5, 9) },
  { id: 4, label: "22→26", numbers: wheelArcNumbersClockwise(22, 26) },
] as const;

/** Grupos em extremidades opostas no anel (quatro sectores de 9 casas). */
export const RUAS_25_OPPOSITE_WHEEL_GROUP: Record<Ruas25WheelGroupId, Ruas25WheelGroupId> = {
  1: 3,
  2: 4,
  3: 1,
  4: 2,
};

const RUAS_25_NUMBER_TO_GROUP = (() => {
  const m = new Map<number, Ruas25WheelGroupId>();
  for (const g of RUAS_25_WHEEL_GROUPS) {
    for (const n of g.numbers) m.set(n, g.id);
  }
  return m;
})();

/** Grupo do cilindro a que pertence `n` (1–36); `null` para zero ou inválido. */
export function ruas25WheelGroupIdForNumber(n: number): Ruas25WheelGroupId | null {
  if (n < 1 || n > 36) return null;
  return RUAS_25_NUMBER_TO_GROUP.get(n) ?? null;
}

export function ruas25WheelGroupsAreOpposite(
  a: Ruas25WheelGroupId,
  b: Ruas25WheelGroupId,
): boolean {
  return RUAS_25_OPPOSITE_WHEEL_GROUP[a] === b;
}

export type Ruas25GroupAbsence = {
  id: Ruas25WheelGroupId;
  label: string;
  spinsSince: number;
};

export type Ruas25PctActive = {
  excludedGroupId: Ruas25WheelGroupId;
  excludedGroupLabel: string;
  excludedNumbers: readonly [number, number];
  excludedNumberGaps: readonly [number, number];
  excludedSpinsSince: number;
  groupAbsenceSpins: readonly Ruas25GroupAbsence[];
  armingDescription: string;
};

function groupNumberSet(group: Ruas25WheelGroup): ReadonlySet<number> {
  return new Set(group.numbers);
}

/** Giros desde a última aparição de qualquer número do grupo (0 = saiu no giro mais recente). */
export function ruas25SpinsSinceGroupLastHit(
  groupNumbers: ReadonlySet<number>,
  historyNewestFirst: readonly number[],
): number {
  return spinsSinceHit(historyNewestFirst, groupNumbers);
}

export function ruas25GroupAbsenceSpins(
  historyNewestFirst: readonly number[],
): readonly Ruas25GroupAbsence[] {
  return RUAS_25_WHEEL_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    spinsSince: ruas25SpinsSinceGroupLastHit(groupNumberSet(g), historyNewestFirst),
  }));
}

export function pickRuas25ColdestWheelGroup(
  historyNewestFirst: readonly number[],
): { group: Ruas25WheelGroup; spinsSince: number; absence: readonly Ruas25GroupAbsence[] } {
  const absence = ruas25GroupAbsenceSpins(historyNewestFirst);
  let best = absence[0]!;
  for (const row of absence) {
    if (row.spinsSince > best.spinsSince) best = row;
    else if (row.spinsSince === best.spinsSince && row.id < best.id) best = row;
  }
  const group = RUAS_25_WHEEL_GROUPS.find((g) => g.id === best.id)!;
  return { group, spinsSince: best.spinsSince, absence };
}

function buildActiveFromHistory(historyNewestFirst: readonly number[]): Ruas25PctActive | null {
  if (historyNewestFirst.length === 0) return null;

  const last = historyNewestFirst[0]!;
  if (last === 0) return null;
  const lastGroupId = ruas25WheelGroupIdForNumber(last);
  if (lastGroupId == null) return null;

  const { group, spinsSince, absence } = pickRuas25ColdestWheelGroup(historyNewestFirst);
  if (!ruas25WheelGroupsAreOpposite(lastGroupId, group.id)) return null;

  const [e0, e1] = twoColdestNumbersInNumberSet(historyNewestFirst, group.numbers);
  const excludedGroupLabel = `Grupo ${group.id} (${group.label})`;

  return {
    excludedGroupId: group.id,
    excludedGroupLabel,
    excludedNumbers: [e0, e1] as const,
    excludedNumberGaps: [
      spinsSinceHit(historyNewestFirst, new Set([e0])),
      spinsSinceHit(historyNewestFirst, new Set([e1])),
    ] as const,
    excludedSpinsSince: spinsSince,
    groupAbsenceSpins: absence,
    armingDescription: `${RUAS_25_PCT_STRATEGY_DISPLAY_NAME}: exclusão ${e0} e ${e1} (${excludedGroupLabel}; último ${last} no grupo oposto).`,
  };
}

/** Estado activo a partir do histórico actual (newest-first). */
export function ruas25PctActiveFromSnapshot(
  historyNewestFirst: readonly number[],
): Ruas25PctActive | null {
  return buildActiveFromHistory(historyNewestFirst);
}

function ruas25PctActiveAfterEachChronologicalPrefix(
  chronological: readonly number[],
): (Ruas25PctActive | null)[] {
  const out: (Ruas25PctActive | null)[] = [];
  for (let i = 0; i < chronological.length; i++) {
    const hnf = chronological.slice(0, i + 1).reverse();
    out.push(buildActiveFromHistory(hnf));
  }
  return out;
}

export function ruas25PctPlacarOutcomes(historyNewestFirst: readonly number[]): ("W" | "L")[] {
  return ruas25PctPlacarEntries(historyNewestFirst).map((e) => e.outcome);
}

export type Ruas25PlacarEntry = {
  outcome: "W" | "L";
  /** Ausência do grupo excluído no momento da indicação (giros sem o grupo). */
  groupAbsenceSpins: number;
  excludedGroupId: Ruas25WheelGroupId;
  excludedNumbers: readonly [number, number];
};

/** Cada entrada do placar com a ausência do grupo no instante da aposta. */
export function ruas25PctPlacarEntries(historyNewestFirst: readonly number[]): Ruas25PlacarEntry[] {
  if (historyNewestFirst.length < 2) return [];
  const chronological = [...historyNewestFirst].reverse();
  const snapshots = ruas25PctActiveAfterEachChronologicalPrefix(chronological);
  const entries: Ruas25PlacarEntry[] = [];

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;
    const num = chronological[k]!;
    const excluded = new Set(active.excludedNumbers);
    entries.push({
      outcome: num !== 0 && excluded.has(num) ? "L" : "W",
      groupAbsenceSpins: active.excludedSpinsSince,
      excludedGroupId: active.excludedGroupId,
      excludedNumbers: active.excludedNumbers,
    });
  }

  return entries;
}

/** Giros de ausência do grupo em que o placar **nunca** registou derrota. */
export function ruas25PctUndefeatedGroupAbsenceSpins(
  historyNewestFirst: readonly number[],
): readonly number[] {
  const buckets = new Map<number, number>();

  for (const entry of ruas25PctPlacarEntries(historyNewestFirst)) {
    if (entry.outcome === "L") buckets.set(entry.groupAbsenceSpins, 1);
    else if (!buckets.has(entry.groupAbsenceSpins)) buckets.set(entry.groupAbsenceSpins, 0);
  }

  return [...buckets.entries()]
    .filter(([, losses]) => losses === 0)
    .map(([absenceSpins]) => absenceSpins)
    .sort((a, b) => a - b);
}

export function ruas25AproveitamentoPctFromHistory(historyNewestFirst: readonly number[]): number {
  const outcomes = ruas25PctPlacarOutcomes(historyNewestFirst);
  if (outcomes.length === 0) return 0;
  const wins = outcomes.filter((x) => x === "W").length;
  return (100 * wins) / outcomes.length;
}

export function ruas25PctPlacarEvolutionSeries(
  historyNewestFirst: readonly number[],
): StreetPlacarEvolutionSeries | null {
  const outcomes = ruas25PctPlacarOutcomes(historyNewestFirst);
  if (outcomes.length === 0) return null;

  let w = 0;
  let l = 0;
  let run = 0;
  let best = 0;
  const cumulativeWins: number[] = [];
  const cumulativeLosses: number[] = [];
  const aproveitamentoPct: number[] = [];
  const streakCurrent: number[] = [];
  const streakMax: number[] = [];

  for (const x of outcomes) {
    if (x === "W") {
      w += 1;
      run += 1;
      best = Math.max(best, run);
    } else {
      l += 1;
      run = 0;
    }
    cumulativeWins.push(w);
    cumulativeLosses.push(l);
    aproveitamentoPct.push(w + l > 0 ? (100 * w) / (w + l) : 0);
    streakCurrent.push(run);
    streakMax.push(best);
  }

  return {
    cumulativeWins,
    cumulativeLosses,
    aproveitamentoPct,
    streakCurrent,
    streakMax,
  };
}
