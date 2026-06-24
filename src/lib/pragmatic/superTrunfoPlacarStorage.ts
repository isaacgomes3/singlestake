import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";

import type { FootballBlitzRoundStored } from "@/lib/pragmatic/dgaFootballBlitzHistory";

import {

  simulateSuperTrunfoPlacar,

  superTrunfoPlacarTotalsFromEntries,

  type SuperTrunfoPlacarOutcome,

  type SuperTrunfoPlacarReplayEntry,

} from "@/lib/pragmatic/superTrunfoPlacar";



export const SUPER_TRUNFO_PLACAR_CHANGED_EVENT = "pragmatic:super-trunfo-placar-changed";



type StoredPlacar = {

  wins: number;

  losses: number;

  outcomes: SuperTrunfoPlacarOutcome[];

  entries: SuperTrunfoPlacarReplayEntry[];

  baselineHeadGameId: string | null;

};



function storageKey(tableKey: number): string {

  return `pragmatic.footballBlitz.placar.${tableKey}.v4`;

}



const EMPTY: StoredPlacar = {

  wins: 0,

  losses: 0,

  outcomes: [],

  entries: [],

  baselineHeadGameId: null,

};



function parseEntries(raw: unknown): SuperTrunfoPlacarReplayEntry[] {

  if (!Array.isArray(raw)) return [];

  const out: SuperTrunfoPlacarReplayEntry[] = [];

  for (const row of raw) {

    if (row == null || typeof row !== "object") continue;

    const o = row as Record<string, unknown>;

    const roundGameId = typeof o.roundGameId === "string" ? o.roundGameId : "";

    if (!roundGameId) continue;

    const outcome = o.outcome === "W" || o.outcome === "L" ? o.outcome : undefined;

    out.push({ roundGameId, outcome });

  }

  return out;

}



function readRaw(tableKey: number): StoredPlacar {

  if (typeof window === "undefined") {

    return { ...EMPTY, outcomes: [], entries: [] };

  }

  try {

    const raw = localStorage.getItem(storageKey(tableKey));

    if (!raw) {

      return { ...EMPTY, outcomes: [], entries: [] };

    }

    const p = JSON.parse(raw) as Partial<StoredPlacar>;

    const entries = parseEntries(p.entries);

    const totals = superTrunfoPlacarTotalsFromEntries(entries);

    const outcomes: SuperTrunfoPlacarOutcome[] = [];

    if (entries.length > 0) {

      outcomes.push(...totals.outcomes);

    } else if (Array.isArray(p.outcomes)) {

      for (const o of p.outcomes) {

        if (o === "W" || o === "L") outcomes.push(o);

      }

    }

    const wins =

      entries.length > 0 ? totals.wins : Math.max(0, Math.floor(Number(p.wins) || 0));

    const losses =

      entries.length > 0 ? totals.losses : Math.max(0, Math.floor(Number(p.losses) || 0));

    return {

      wins,

      losses,

      outcomes,

      entries,

      baselineHeadGameId:

        typeof p.baselineHeadGameId === "string" && p.baselineHeadGameId

          ? p.baselineHeadGameId

          : null,

    };

  } catch {

    return { ...EMPTY, outcomes: [], entries: [] };

  }

}



function write(tableKey: number, data: StoredPlacar) {

  if (typeof window === "undefined") return;

  try {

    localStorage.setItem(storageKey(tableKey), JSON.stringify(data));

    window.dispatchEvent(

      new CustomEvent(SUPER_TRUNFO_PLACAR_CHANGED_EVENT, { detail: { tableKey } }),

    );

  } catch {

    /* */

  }

}



function toState(data: StoredPlacar): SuperTrunfoPlacarState {

  const total = data.wins + data.losses;

  return {

    wins: data.wins,

    losses: data.losses,

    aproveitamentoPct: total > 0 ? (100 * data.wins) / total : 0,

    outcomes: [...data.outcomes],

    rodadas: data.entries.length,

  };

}



function mergeIncrementalEntries(

  stored: StoredPlacar,

  sim: ReturnType<typeof simulateSuperTrunfoPlacar>,

): StoredPlacar {

  const knownIds = new Set(stored.entries.map((e) => e.roundGameId));

  const appended = sim.entries.filter((e) => !knownIds.has(e.roundGameId));

  const entries = appended.length > 0 ? [...stored.entries, ...appended] : [...stored.entries];

  const totals = superTrunfoPlacarTotalsFromEntries(entries);



  return {

    wins: totals.wins,

    losses: totals.losses,

    outcomes: totals.outcomes,

    entries,

    baselineHeadGameId: stored.baselineHeadGameId,

  };

}



export type SuperTrunfoPlacarState = {

  wins: number;

  losses: number;

  aproveitamentoPct: number;

  outcomes: SuperTrunfoPlacarOutcome[];

  /** Entradas liquidadas (persistem além da janela de 22 rondas do histórico). */
  rodadas: number;

};



export function readSuperTrunfoPlacar(tableKey: number): SuperTrunfoPlacarState {

  return toState(readRaw(tableKey));

}



/**

 * Sincroniza placar com o histórico: só **acrescenta** liquidações novas (por `gameId`).

 * Vitórias/derrotas já contabilizadas não são removidas quando a janela do histórico desliza.

 */

export function syncSuperTrunfoPlacarFromHistory(

  tableKey: number,

  historyNewestFirst: readonly FootballBlitzRoundStored[],

  variant: FootballBlitzTableVariant,

): SuperTrunfoPlacarState {

  const stored = readRaw(tableKey);

  const sim = simulateSuperTrunfoPlacar(historyNewestFirst, variant, {

    baselineHeadGameId: stored.baselineHeadGameId,

  });



  const next = mergeIncrementalEntries(stored, sim);



  const changed =

    next.wins !== stored.wins ||

    next.losses !== stored.losses ||

    next.entries.length !== stored.entries.length;



  if (changed) {

    write(tableKey, next);

  }



  return toState(next);

}



/** Zera contadores; só volta a contar após nova ronda (cabeça do histórico muda). */

export function resetSuperTrunfoPlacar(

  tableKey: number,

  historyNewestFirst: readonly FootballBlitzRoundStored[],

  _variant: FootballBlitzTableVariant,

): SuperTrunfoPlacarState {

  const headId = historyNewestFirst[0]?.gameId ?? null;

  write(tableKey, {

    ...EMPTY,

    outcomes: [],

    entries: [],

    baselineHeadGameId: headId,

  });

  return readSuperTrunfoPlacar(tableKey);

}

