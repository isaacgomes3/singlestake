import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  analyzeFootballStudioSidePatterns,
  normalizeBridgeRound,
  type FootballStudioRound,
} from "@/lib/evolution/footballStudioSidePatterns";
import { findFootballStudioEcoSignal } from "@/lib/evolution/footballStudioEcoStrategy";
import { parseTopCardEvoMessage, formatTopCardLabel, suitLabelFor } from "@/lib/evolution/topCardEvoParser";
import type { TopCardParsedCard } from "@/lib/evolution/topCardEvoParser";

import type {
  FootballStudioDisplayRound,
  FootballStudioHubCardRound,
  FootballStudioHubMessage,
  FootballStudioHubSnapshot,
} from "./types";
import { isFootballStudioSide } from "./types";

const MAX_HISTORY = 500;
const MAX_CARDS = 300;
const PERSIST_DIR = path.join(process.cwd(), "data", "football-studio");
const PERSIST_FILE = path.join(PERSIST_DIR, "hub-state.json");

type Listener = (msg: FootballStudioHubMessage) => void;

/** Estado em globalThis — sobrevive ao HMR do Vite (senão o painel “para” de receber). */
type FootballStudioHubRuntime = {
  listeners: Set<Listener>;
  history: FootballStudioRound[];
  cardHistory: FootballStudioHubCardRound[];
  lastCards: FootballStudioHubCardRound | null;
  cardsFeedSource: string | null;
  bridgeStatus: FootballStudioHubSnapshot["bridgeStatus"];
  lastError: string | null;
  updatedAt: string | null;
  channel: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  hydrated: boolean;
};

const g = globalThis as typeof globalThis & {
  __singlestakeFootballStudioHub?: FootballStudioHubRuntime;
};

const R: FootballStudioHubRuntime = (g.__singlestakeFootballStudioHub ??= {
  listeners: new Set<Listener>(),
  history: [],
  cardHistory: [],
  lastCards: null,
  cardsFeedSource: null,
  bridgeStatus: "idle",
  lastError: null,
  updatedAt: null,
  channel: "evolution.football-studio",
  persistTimer: null,
  hydrated: false,
});

function broadcast(msg: FootballStudioHubMessage) {
  for (const listener of R.listeners) {
    try {
      listener(msg);
    } catch {
      /* ignore listener errors */
    }
  }
}

function repairParsedCard(card: TopCardParsedCard | null | undefined): TopCardParsedCard | null {
  if (!card) return null;
  const label = formatTopCardLabel(card);
  if (!label) return null;
  const suitRaw = String(card.suit ?? "").toUpperCase();
  const suit = (suitRaw === "H" || suitRaw === "S" || suitRaw === "D" || suitRaw === "C"
    ? suitRaw
    : "H") as TopCardParsedCard["suit"];
  return {
    ...card,
    suit,
    suitLabel: suitLabelFor(suit),
    label,
    rank: String(card.rank ?? "").trim() || label.replace(/[^\dAJQK]/gi, ""),
    code: String(card.code ?? "").trim() || `${card.rank ?? ""}${suit}`,
  };
}

function repairCardRound(round: FootballStudioHubCardRound): FootballStudioHubCardRound | null {
  const home = repairParsedCard(round.home ?? null);
  const away = repairParsedCard(round.away ?? null);
  if (!home || !away) return null;
  return { ...round, home, away };
}

function hasCardLabels(round: {
  home?: { label?: string; rank?: string; suit?: string; code?: string } | null;
  away?: { label?: string; rank?: string; suit?: string; code?: string } | null;
}) {
  return Boolean(formatTopCardLabel(round?.home) && formatTopCardLabel(round?.away));
}

function buildDisplayRounds(): FootballStudioDisplayRound[] {
  // Fonte única quando há cartas (DinhuTech / Obs): não misturar Bridge.
  const cards = R.cardHistory.filter((c) => hasCardLabels(c));
  if (cards.length > 0) {
    return cards.slice(0, 64).map((c) => {
      const home = repairParsedCard(c.home);
      const away = repairParsedCard(c.away);
      return {
        gameId: String(c.gameId),
        winner: c.winner,
        home,
        away,
        evoGameId: c.gameId,
        bridgeOnly: false as const,
        at: c.at,
      };
    });
  }

  // Sem cartas: só cores Bridge (sem naipe).
  return R.history.slice(0, 64).map((bridge) => ({
    ...bridge,
    home: null,
    away: null,
    bridgeOnly: true as const,
  }));
}

function snapshotNote(display: FootballStudioDisplayRound[]): string {
  const withCards = display.filter((r) => !r.bridgeOnly).length;
  if (withCards > 0) {
    return `DinhuTech/cartas ao vivo · ${withCards} rodadas (sem misturar Bridge)`;
  }
  if (R.bridgeStatus !== "ok") {
    return "A ligar Bridge… (ou inicia o feeder DinhuTech para cartas)";
  }
  return "Bridge ao vivo (só cores). Para cartas: npm run feeder:football-studio:dinhutech";
}

export function getFootballStudioHubSnapshot(): FootballStudioHubSnapshot {
  const displayRounds = buildDisplayRounds();
  const cardsWithSuits = displayRounds.filter((r) => hasCardLabels(r)).length;
  const ecoSource = R.cardHistory.filter((r) => hasCardLabels(r));
  const ecoSignal = findFootballStudioEcoSignal(ecoSource);
  // Com cartas: history do snapshot = lados das cartas (não Bridge).
  const sideHistory =
    ecoSource.length > 0
      ? ecoSource.map((c) => ({
          gameId: String(c.gameId),
          winner: c.winner,
          time: typeof c.at === "number" ? new Date(c.at).toISOString() : undefined,
        }))
      : R.history.slice(0, MAX_HISTORY);
  return {
    ok: true,
    channel: R.channel,
    bridgeStatus: R.bridgeStatus,
    lastError: R.lastError,
    updatedAt: R.updatedAt,
    history: sideHistory,
    displayRounds,
    cardHistory: R.cardHistory.slice(0, 80),
    lastCards: R.lastCards,
    cardsWithSuits,
    note: snapshotNote(displayRounds),
    ecoSignal,
  };
}

export function getFootballStudioSidePatterns(minSamples = 2) {
  const ecoSource = R.cardHistory.filter((r) => hasCardLabels(r));
  const sideHistory =
    ecoSource.length > 0
      ? ecoSource.map((c) => ({
          gameId: String(c.gameId),
          winner: c.winner,
        }))
      : R.history;
  return analyzeFootballStudioSidePatterns(sideHistory, { minSamples });
}

function schedulePersist() {
  if (R.persistTimer) return;
  R.persistTimer = setTimeout(() => {
    R.persistTimer = null;
    void persistHubState();
  }, 800);
}

async function persistHubState() {
  try {
    await mkdir(PERSIST_DIR, { recursive: true });
    await writeFile(
      PERSIST_FILE,
      JSON.stringify(
        {
          channel: R.channel,
          updatedAt: R.updatedAt,
          history: R.history.slice(0, MAX_HISTORY),
          cardHistory: R.cardHistory.slice(0, MAX_CARDS),
          lastCards: R.lastCards,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    console.warn("[Football Studio] hub: falha ao persistir", error);
  }
}

export async function hydrateFootballStudioHub(): Promise<void> {
  if (R.hydrated) return;
  R.hydrated = true;
  // Já há cartas ao vivo (ingest antes do hydrate) — não sobrescrever com disco antigo.
  if (R.cardHistory.length > 0 && R.lastCards) {
    console.log(
      `[Football Studio] hub: mantém ${R.cardHistory.length} cartas em memória (skip disco)`,
    );
    return;
  }
  try {
    const raw = await readFile(PERSIST_FILE, "utf8");
    const parsed = JSON.parse(raw) as {
      channel?: string;
      updatedAt?: string | null;
      history?: FootballStudioRound[];
      cardHistory?: FootballStudioHubCardRound[];
      lastCards?: FootballStudioHubCardRound | null;
    };
    if (typeof parsed.channel === "string" && parsed.channel.trim()) {
      R.channel = parsed.channel.trim();
    }
    if (Array.isArray(parsed.history)) {
      R.history = parsed.history.filter((r) => r?.gameId && isFootballStudioSide(r.winner));
    }
    if (Array.isArray(parsed.cardHistory)) {
      R.cardHistory = parsed.cardHistory
        .map((r) => repairCardRound(r))
        .filter((r): r is FootballStudioHubCardRound => Boolean(r?.gameId));
    }
    R.lastCards = parsed.lastCards
      ? repairCardRound(parsed.lastCards)
      : (R.cardHistory[0] ?? null);
    if (!R.lastCards && R.cardHistory[0]) R.lastCards = R.cardHistory[0];
    R.updatedAt = parsed.updatedAt ?? null;
    R.cardsFeedSource = "dinhutech";
    console.log(
      `[Football Studio] hub: restaurado ${R.history.length} lados · ${R.cardHistory.length} cartas`,
    );
  } catch {
    /* sem ficheiro ainda */
  }
}

export function applyBridgeHistory(rows: unknown[], nextUpdatedAt?: string | null) {
  const next: FootballStudioRound[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const normalized = normalizeBridgeRound(
      row as { _id?: string; id?: string; createdAt?: string; winner?: string },
    );
    if (!normalized || seen.has(normalized.gameId)) continue;
    seen.add(normalized.gameId);
    next.push(normalized);
  }
  const prevHead = R.history[0]?.gameId ?? null;
  R.history = next.slice(0, MAX_HISTORY);
  R.bridgeStatus = "ok";
  R.lastError = null;

  // Com cartas DinhuTech/Obs o painel usa só cartas — não actualizar updatedAt
  // nem emitir SSE (era isto que fazia o visor oscilar a cada ~2s).
  const hasCards = R.cardHistory.some((c) => hasCardLabels(c));
  if (hasCards) {
    schedulePersist();
    return;
  }

  R.updatedAt = nextUpdatedAt ?? new Date().toISOString();
  schedulePersist();
  const snap = getFootballStudioHubSnapshot();
  broadcast({ type: "snapshot", snapshot: snap });
  if (R.history[0] && R.history[0].gameId !== prevHead) {
    broadcast({ type: "bridge-round", round: R.history[0] });
  }
}

export function setFootballStudioBridgeStatus(
  status: FootballStudioHubSnapshot["bridgeStatus"],
  message?: string | null,
) {
  R.bridgeStatus = status;
  R.lastError = message ?? null;
  // Só status — nunca snapshot completo (evita oscilar o painel).
  broadcast({ type: "status", bridgeStatus: status, message: message ?? undefined });
}

export function setFootballStudioChannel(next: string) {
  if (next.trim()) R.channel = next.trim();
}

export function ingestFootballStudioCards(
  round: FootballStudioHubCardRound,
  options?: { feed?: string },
): FootballStudioHubSnapshot {
  if (!round?.gameId) return getFootballStudioHubSnapshot();

  const feed = String(options?.feed ?? "").trim().toLowerCase() || "unknown";
  const allowed = String(process.env.FOOTBALL_STUDIO_CARDS_SOURCE ?? "dinhutech")
    .trim()
    .toLowerCase();
  // Por defeito só DinhuTech — rejeita Obs/Playwright para não misturar mesas.
  if (allowed && allowed !== "any" && feed !== allowed) {
    return getFootballStudioHubSnapshot();
  }
  if (feed === "dinhutech") R.cardsFeedSource = "dinhutech";

  const at = typeof round.at === "number" ? round.at : Date.now();
  const repaired = repairCardRound({ ...round, at }) ?? { ...round, at };
  const next = repaired;
  const prevHeadId = R.lastCards?.gameId ?? null;
  const prevHeadKey = R.lastCards
    ? `${R.lastCards.gameId}|${R.lastCards.winner}|${R.lastCards.home?.rank}|${R.lastCards.away?.rank}`
    : "";

  const idx = R.cardHistory.findIndex((item) => item.gameId === next.gameId);
  if (idx >= 0) {
    R.cardHistory[idx] = { ...R.cardHistory[idx], ...next };
  } else {
    R.cardHistory = [next, ...R.cardHistory].slice(0, MAX_CARDS);
  }
  if (hasCardLabels(next)) R.lastCards = next;

  const nextHeadKey = R.lastCards
    ? `${R.lastCards.gameId}|${R.lastCards.winner}|${R.lastCards.home?.rank}|${R.lastCards.away?.rank}`
    : "";
  // Sem mudança no visor → não emitir SSE (evita oscilar).
  if (nextHeadKey === prevHeadKey && idx >= 0) {
    schedulePersist();
    return getFootballStudioHubSnapshot();
  }

  R.updatedAt = new Date().toISOString();
  schedulePersist();
  const snap = getFootballStudioHubSnapshot();
  broadcast({ type: "snapshot", snapshot: snap });
  if (R.lastCards?.gameId !== prevHeadId) {
    console.log(
      `[Football Studio] cartas ${R.lastCards?.home?.label}/${R.lastCards?.away?.label} → ${R.lastCards?.winner}`,
    );
  }
  return snap;
}

export function ingestFootballStudioEvoText(text: string, at = Date.now()): FootballStudioHubSnapshot | null {
  const parsed = parseTopCardEvoMessage(text);
  if (!parsed?.gameId) return null;
  if (parsed.source === "cardDealt" && parsed.home && parsed.away) {
    return ingestFootballStudioCards({ ...parsed, at });
  }
  if (parsed.source === "resolved") {
    const idx = R.cardHistory.findIndex((item) => item.gameId === parsed.gameId);
    if (idx >= 0) {
      R.cardHistory[idx] = {
        ...R.cardHistory[idx],
        winner: parsed.winner,
        homeScore: parsed.homeScore ?? R.cardHistory[idx].homeScore,
        awayScore: parsed.awayScore ?? R.cardHistory[idx].awayScore,
        at: R.cardHistory[idx].at ?? at,
      };
      if (R.lastCards?.gameId === parsed.gameId) R.lastCards = { ...R.cardHistory[idx] };
      schedulePersist();
      broadcast({ type: "cards", round: R.cardHistory[idx]! });
      const snap = getFootballStudioHubSnapshot();
      broadcast({ type: "snapshot", snapshot: snap });
      return snap;
    }
  }
  return null;
}

export function subscribeFootballStudioHub(listener: Listener): () => void {
  R.listeners.add(listener);
  listener({ type: "ready", snapshot: getFootballStudioHubSnapshot() });
  return () => {
    R.listeners.delete(listener);
  };
}
