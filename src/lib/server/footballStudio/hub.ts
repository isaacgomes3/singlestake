import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  analyzeFootballStudioSidePatterns,
  normalizeBridgeRound,
  type FootballStudioRound,
} from "@/lib/evolution/footballStudioSidePatterns";
import { findFootballStudioEcoSignal, type FootballStudioEcoSignal } from "@/lib/evolution/footballStudioEcoStrategy";
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

type StickyCardAttach = {
  home: TopCardParsedCard;
  away: TopCardParsedCard;
  winner?: FootballStudioHubCardRound["winner"] | null;
  at?: number;
  evoGameId?: string | null;
};

/** Estado em globalThis — sobrevive ao HMR do Vite (senão o painel “para” de receber). */
type FootballStudioHubRuntime = {
  listeners: Set<Listener>;
  history: FootballStudioRound[];
  cardHistory: FootballStudioHubCardRound[];
  /** Bridge gameId → cartas DinhuTech já casadas (não re-atribuir). */
  stickyCards: Record<string, StickyCardAttach>;
  lastCards: FootballStudioHubCardRound | null;
  cardsFeedSource: string | null;
  bridgeStatus: FootballStudioHubSnapshot["bridgeStatus"];
  lastError: string | null;
  updatedAt: string | null;
  channel: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
  hydrated: boolean;
  ecoWins: number;
  ecoLosses: number;
  ecoPending: FootballStudioEcoSignal | null;
  suitEcoWins: number;
  suitEcoLosses: number;
  suitEcoPending: FootballStudioEcoSignal | null;
};

const g = globalThis as typeof globalThis & {
  __singlestakeFootballStudioHub?: FootballStudioHubRuntime;
};

const R: FootballStudioHubRuntime = (g.__singlestakeFootballStudioHub ??= {
  listeners: new Set<Listener>(),
  history: [],
  cardHistory: [],
  stickyCards: {},
  lastCards: null,
  cardsFeedSource: null,
  bridgeStatus: "idle",
  lastError: null,
  updatedAt: null,
  channel: "evolution.football-studio",
  persistTimer: null,
  hydrated: false,
  ecoWins: 0,
  ecoLosses: 0,
  ecoPending: null,
  suitEcoWins: 0,
  suitEcoLosses: 0,
  suitEcoPending: null,
});

if (!R.stickyCards) R.stickyCards = {};

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

/** Recalcula placar Eco (ranks) e 100% naipe a partir do histórico. */
function rebuildEcoStats() {
  if (typeof R.ecoWins !== "number") R.ecoWins = 0;
  if (typeof R.ecoLosses !== "number") R.ecoLosses = 0;
  if (typeof R.suitEcoWins !== "number") R.suitEcoWins = 0;
  if (typeof R.suitEcoLosses !== "number") R.suitEcoLosses = 0;

  // Com Bridge: avalia com winners Evolution + cartas casadas.
  const newestFirst: FootballStudioHubCardRound[] =
    R.history.length > 0
      ? buildDisplayRounds()
          .filter((r) => hasCardLabels(r) && r.home && r.away)
          .map(
            (r) =>
              ({
                gameId: String(r.evoGameId || r.gameId),
                winner: r.winner,
                home: r.home!,
                away: r.away!,
                at: r.at,
                source: "history" as const,
              }) satisfies FootballStudioHubCardRound,
          )
      : R.cardHistory.filter((r) => hasCardLabels(r));
  let wins = 0;
  let losses = 0;
  let suitWins = 0;
  let suitLosses = 0;
  let pending: FootballStudioEcoSignal | null = null;
  let suitPending: FootballStudioEcoSignal | null = null;

  for (let headIdx = newestFirst.length - 1; headIdx >= 0; headIdx -= 1) {
    const slice = newestFirst.slice(headIdx);
    const head = slice[0];
    if (!head) continue;

    if (pending && head.gameId !== pending.triggerGameId) {
      if (head.winner === pending.indication) wins += 1;
      else losses += 1;
      pending = null;
    }
    if (suitPending && head.gameId !== suitPending.triggerGameId) {
      if (head.winner === suitPending.indication) suitWins += 1;
      else suitLosses += 1;
      suitPending = null;
    }

    pending = findFootballStudioEcoSignal(slice);
    suitPending = findFootballStudioEcoSignal(slice, { requireSuits: true });
  }

  R.ecoWins = wins;
  R.ecoLosses = losses;
  R.ecoPending = pending;
  R.suitEcoWins = suitWins;
  R.suitEcoLosses = suitLosses;
  R.suitEcoPending = suitPending;
}

function cardTimestamp(card: { at?: number; time?: string } | null | undefined): number {
  if (typeof card?.at === "number" && Number.isFinite(card.at)) return card.at;
  if (card?.time) {
    const parsed = Date.parse(card.time);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

/**
 * Bridge = verdade (cor + ordem). DinhuTech = só cartas.
 * Casa cartas por winner + tempo (IDs Bridge ≠ IDs Evolution).
 */
function findCardsForBridgeRound(
  bridgeRound: FootballStudioRound,
  usedEvoIds: Set<string>,
): FootballStudioHubCardRound | null {
  const bridgeAt = bridgeRound.time ? Date.parse(bridgeRound.time) : Number.NaN;
  let best: FootballStudioHubCardRound | null = null;
  let bestScore = Infinity;
  for (const card of R.cardHistory) {
    if (!hasCardLabels(card)) continue;
    const evoId = card.gameId ? String(card.gameId) : "";
    if (evoId && usedEvoIds.has(evoId)) continue;
    if (card.winner && bridgeRound.winner && card.winner !== bridgeRound.winner) continue;
    const cardAt = cardTimestamp(card);
    if (Number.isFinite(bridgeAt) && Number.isFinite(cardAt)) {
      if (cardAt < bridgeAt - 300_000 || cardAt > bridgeAt + 180_000) continue;
      const delta = Math.abs(cardAt - bridgeAt);
      if (delta < bestScore) {
        bestScore = delta;
        best = card;
      }
      continue;
    }
    if (!best) best = card;
  }
  return best;
}

function rememberSticky(bridgeId: string, cards: FootballStudioHubCardRound) {
  const home = repairParsedCard(cards.home);
  const away = repairParsedCard(cards.away);
  if (!bridgeId || !home || !away) return;
  R.stickyCards[bridgeId] = {
    home,
    away,
    winner: cards.winner,
    at: cardTimestamp(cards),
    evoGameId: cards.gameId ?? null,
  };
}

function applyCardsOntoBridge(
  bridge: FootballStudioRound,
  cards: StickyCardAttach | FootballStudioHubCardRound | null,
): FootballStudioDisplayRound {
  if (!cards || !hasCardLabels(cards)) {
    return {
      ...bridge,
      home: null,
      away: null,
      bridgeOnly: true,
    };
  }
  const home = repairParsedCard(cards.home);
  const away = repairParsedCard(cards.away);
  if (!home || !away) {
    return {
      ...bridge,
      home: null,
      away: null,
      bridgeOnly: true,
    };
  }
  return {
    ...bridge,
    // Winner sempre da Bridge Evolution.
    winner: bridge.winner,
    home,
    away,
    at: cardTimestamp(cards) || (bridge.time ? Date.parse(bridge.time) : undefined),
    evoGameId:
      ("evoGameId" in cards ? cards.evoGameId : null) ||
      ("gameId" in cards ? cards.gameId : null) ||
      null,
    bridgeOnly: false,
  };
}

function buildDisplayRounds(): FootballStudioDisplayRound[] {
  const bridges = R.history.slice(0, 64);
  if (bridges.length === 0) {
    // Sem Bridge ainda: fallback só cartas (arranque / poller).
    return R.cardHistory
      .filter((c) => hasCardLabels(c))
      .slice(0, 64)
      .map((c) => ({
        gameId: String(c.gameId),
        winner: c.winner,
        home: repairParsedCard(c.home),
        away: repairParsedCard(c.away),
        evoGameId: c.gameId,
        bridgeOnly: false as const,
        at: c.at,
      }));
  }

  const usedEvo = new Set<string>();
  for (const bridge of bridges) {
    const sticky = R.stickyCards[String(bridge.gameId)];
    const eid = sticky?.evoGameId;
    if (eid && sticky && (!sticky.winner || sticky.winner === bridge.winner)) {
      usedEvo.add(String(eid));
    }
  }

  const out: FootballStudioDisplayRound[] = [];
  for (const bridge of bridges) {
    if (!bridge?.gameId) continue;
    const bid = String(bridge.gameId);
    let sticky: StickyCardAttach | undefined = R.stickyCards[bid];
    if (sticky && sticky.winner && sticky.winner !== bridge.winner) {
      delete R.stickyCards[bid];
      sticky = undefined;
    }
    if (!sticky || !hasCardLabels(sticky)) {
      const pick = findCardsForBridgeRound(bridge, usedEvo);
      if (pick) {
        rememberSticky(bid, pick);
        const eid = pick.gameId ? String(pick.gameId) : "";
        if (eid) usedEvo.add(eid);
        sticky = R.stickyCards[bid];
      }
    } else {
      const eid = sticky.evoGameId ? String(sticky.evoGameId) : "";
      if (eid) usedEvo.add(eid);
    }
    out.push(applyCardsOntoBridge(bridge, sticky ?? null));
  }
  return out;
}

function snapshotNote(display: FootballStudioDisplayRound[]): string {
  const withCards = display.filter((r) => !r.bridgeOnly).length;
  const total = display.length;
  if (R.bridgeStatus === "ok" && total > 0) {
    return `Evolution Bridge (verdade) · ${total} rodadas · DinhuTech cartas em ${withCards}`;
  }
  if (withCards > 0) {
    return `DinhuTech cartas · ${withCards} (à espera da Bridge Evolution)`;
  }
  if (R.bridgeStatus !== "ok") {
    return "A ligar Bridge Evolution… DinhuTech fornece cartas por rodada.";
  }
  return "Bridge ao vivo (só cores). Cartas via DinhuTech em breve.";
}

export function getFootballStudioHubSnapshot(): FootballStudioHubSnapshot {
  const displayRounds = buildDisplayRounds();
  const cardsWithSuits = displayRounds.filter((r) => hasCardLabels(r)).length;
  // Eco: cartas DinhuTech com winner alinhado à Bridge quando possível.
  const ecoSource = displayRounds
    .filter((r): r is FootballStudioDisplayRound & { home: TopCardParsedCard; away: TopCardParsedCard } =>
      Boolean(hasCardLabels(r) && r.home && r.away),
    )
    .map(
      (r) =>
        ({
          gameId: String(r.evoGameId || r.gameId),
          winner: r.winner,
          home: r.home,
          away: r.away,
          at: r.at,
          source: "history" as const,
        }) satisfies FootballStudioHubCardRound,
    );
  const ecoSignal = findFootballStudioEcoSignal(ecoSource);
  const suitEcoSignal = findFootballStudioEcoSignal(ecoSource, { requireSuits: true });
  return {
    ok: true,
    channel: R.channel,
    bridgeStatus: R.bridgeStatus,
    lastError: R.lastError,
    updatedAt: R.updatedAt,
    // Verdade = Bridge Evolution.
    history: R.history.slice(0, MAX_HISTORY),
    displayRounds,
    cardHistory: R.cardHistory.slice(0, 80),
    lastCards: R.lastCards,
    cardsWithSuits,
    note: snapshotNote(displayRounds),
    ecoSignal,
    ecoStats: {
      wins: Number(R.ecoWins) || 0,
      losses: Number(R.ecoLosses) || 0,
    },
    suitEcoSignal,
    suitEcoStats: {
      wins: Number(R.suitEcoWins) || 0,
      losses: Number(R.suitEcoLosses) || 0,
    },
  };
}

export function getFootballStudioSidePatterns(minSamples = 2) {
  // Padrões de lado: Bridge como fonte de verdade.
  return analyzeFootballStudioSidePatterns(R.history, { minSamples });
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
          stickyCards: R.stickyCards,
          lastCards: R.lastCards,
          ecoWins: R.ecoWins,
          ecoLosses: R.ecoLosses,
          ecoPending: R.ecoPending,
          suitEcoWins: R.suitEcoWins,
          suitEcoLosses: R.suitEcoLosses,
          suitEcoPending: R.suitEcoPending,
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

export async function hydrateFootballStudioHub(options?: { force?: boolean }): Promise<void> {
  const force = options?.force === true;
  // Já hidratado com cartas → não sobrescrever feed ao vivo com disco antigo.
  if (!force && R.hydrated && R.cardHistory.length > 0) {
    return;
  }
  // force ou memória vazia: permitir ler o disco de novo.
  if (force || (R.hydrated && R.cardHistory.length === 0)) {
    R.hydrated = false;
  }
  if (R.hydrated) return;
  R.hydrated = true;

  // Já há cartas ao vivo (ingest antes do hydrate) — não sobrescrever com disco antigo.
  if (R.cardHistory.length > 0 && R.lastCards) {
    syncHistoryFromCards();
    rebuildEcoStats();
    console.log(
      `[Football Studio] hub: mantém ${R.cardHistory.length} cartas em memória (skip disco) · Eco ${R.ecoWins}V/${R.ecoLosses}D`,
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
      stickyCards?: Record<string, StickyCardAttach>;
      lastCards?: FootballStudioHubCardRound | null;
      ecoWins?: number;
      ecoLosses?: number;
      ecoPending?: FootballStudioEcoSignal | null;
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
    if (parsed.stickyCards && typeof parsed.stickyCards === "object") {
      R.stickyCards = parsed.stickyCards;
    }
    R.lastCards = parsed.lastCards
      ? repairCardRound(parsed.lastCards)
      : (R.cardHistory[0] ?? null);
    if (!R.lastCards && R.cardHistory[0]) R.lastCards = R.cardHistory[0];
    R.updatedAt = parsed.updatedAt ?? null;
    R.cardsFeedSource = "dinhutech";
    syncHistoryFromCards();
    // Recalcula placar a partir do histórico (fonte de verdade).
    rebuildEcoStats();
    console.log(
      `[Football Studio] hub: restaurado ${R.history.length} lados · ${R.cardHistory.length} cartas · Eco ${R.ecoWins}V/${R.ecoLosses}D`,
    );
  } catch {
    /* sem ficheiro ainda */
  }
}

/**
 * Só preenche history a partir de cartas se a Bridge ainda não trouxe dados.
 * Nunca sobrescreve a sequência Evolution.
 */
function syncHistoryFromCards() {
  if (R.history.length > 0) return;
  if (R.cardHistory.length === 0) return;
  const fromCards: FootballStudioRound[] = [];
  const seen = new Set<string>();
  for (const card of R.cardHistory) {
    if (!card?.gameId || seen.has(card.gameId)) continue;
    if (!isFootballStudioSide(card.winner)) continue;
    seen.add(card.gameId);
    fromCards.push({
      gameId: card.gameId,
      winner: card.winner,
      time: typeof card.at === "number" ? new Date(card.at).toISOString() : undefined,
    });
  }
  if (fromCards.length === 0) return;
  R.history = fromCards.slice(0, MAX_HISTORY);
}

function pruneStickyCards() {
  const keep = new Set(R.history.slice(0, 80).map((r) => String(r.gameId)));
  for (const id of Object.keys(R.stickyCards)) {
    if (!keep.has(id)) {
      delete R.stickyCards[id];
      continue;
    }
    const bridge = R.history.find((r) => String(r.gameId) === id);
    const sticky = R.stickyCards[id];
    if (bridge && sticky?.winner && sticky.winner !== bridge.winner) {
      delete R.stickyCards[id];
    }
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
  const prevKey = R.history.map((r) => `${r.gameId}:${r.winner}`).join("|");
  R.history = next.slice(0, MAX_HISTORY);
  R.bridgeStatus = "ok";
  R.lastError = null;
  pruneStickyCards();

  const nextKey = R.history.map((r) => `${r.gameId}:${r.winner}`).join("|");
  // Sem mudança na verdade Bridge → não emitir SSE (evita oscilar a cada poll).
  if (prevKey === nextKey && prevHead === (R.history[0]?.gameId ?? null)) {
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

  // Actualiza placar Eco quando a cabeça do histórico muda (ou cards novos).
  if (R.lastCards?.gameId !== prevHeadId || idx < 0) {
    rebuildEcoStats();
  }

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
      rebuildEcoStats();
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
