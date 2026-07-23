/**
 * Poller DinhuTech embutido no daemon do hub.
 * Assim o painel BO recebe cartas sem depender do script feeder externo.
 *
 * Env:
 *   FOOTBALL_STUDIO_DINHUTECH_POLL=0  → desliga
 *   DINHUTECH_FS_ID / DINHUTECH_FS_API / DINHUTECH_POLL_MS / DINHUTECH_AUTH
 */

import { parseTopCardCode, type TopCardParsedCard, type TopCardSide } from "@/lib/evolution/topCardEvoParser";
import { ingestFootballStudioCards } from "./hub";

type DinhuCardSide = { card?: string; score?: number };
type DinhuCardRound = {
  gameId?: string;
  gameNumber?: string;
  Dragon?: DinhuCardSide;
  Tiger?: DinhuCardSide;
};
type DinhuState = {
  currentCards?: DinhuCardRound | null;
  cards?: Array<DinhuCardRound | null>;
  available?: boolean;
  workerStatus?: string;
};

const DEFAULT_LAUNCH_ID = "48694";
const DEFAULT_API = "https://api.dinhutech.com.br";
const DEFAULT_POLL_MS = 2000;

function parseSide(raw: DinhuCardSide | undefined): TopCardParsedCard | null {
  if (!raw?.card) return null;
  return parseTopCardCode(raw.card, raw.score);
}

function roundFromDinhu(card: DinhuCardRound): {
  gameId: string;
  gameNumber?: string;
  winner: TopCardSide;
  home: TopCardParsedCard;
  away: TopCardParsedCard;
  homeScore: number;
  awayScore: number;
} | null {
  const gameId = String(card.gameId ?? "").trim();
  const home = parseSide(card.Dragon);
  const away = parseSide(card.Tiger);
  if (!gameId || !home || !away) return null;
  const winner: TopCardSide =
    home.score === away.score ? "draw" : home.score > away.score ? "home" : "away";
  return {
    gameId,
    gameNumber: typeof card.gameNumber === "string" ? card.gameNumber : undefined,
    winner,
    home,
    away,
    homeScore: home.score,
    awayScore: away.score,
  };
}

function collectRounds(state: DinhuState) {
  const cards = (state.cards ?? []).filter(Boolean) as DinhuCardRound[];
  const rounds: NonNullable<ReturnType<typeof roundFromDinhu>>[] = [];
  for (const card of cards) {
    const round = roundFromDinhu(card);
    if (round) rounds.push(round);
  }
  if (state.currentCards?.gameId) {
    const current = roundFromDinhu(state.currentCards);
    if (current && !rounds.some((r) => r.gameId === current.gameId)) {
      rounds.push(current);
    }
  }
  return rounds;
}

async function fetchState(
  apiBase: string,
  launchId: string,
  auth: string,
): Promise<DinhuState | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "singlestake-fs-dinhutech-poller/1.0",
  };
  if (auth) {
    if (/^Bearer\s+/i.test(auth) || auth.includes("=")) {
      if (/^Bearer\s+/i.test(auth)) headers.Authorization = auth;
      else headers.Cookie = auth;
    } else {
      headers.Authorization = `Bearer ${auth}`;
    }
  }
  const url = `${apiBase}/api/v1/analyzers/football-studio/${launchId}/state`;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`[Football Studio] dinhutech HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as DinhuState;
  } catch (error) {
    console.warn(
      "[Football Studio] dinhutech fetch falhou:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export function startFootballStudioDinhutechPoller(): void {
  const g = globalThis as typeof globalThis & {
    __singlestakeFsDinhutechPoller?: boolean;
  };
  if (g.__singlestakeFsDinhutechPoller) return;
  g.__singlestakeFsDinhutechPoller = true;

  const disabled = String(process.env.FOOTBALL_STUDIO_DINHUTECH_POLL ?? "1").trim() === "0";
  if (disabled) {
    console.log("[Football Studio] dinhutech poller OFF (FOOTBALL_STUDIO_DINHUTECH_POLL=0)");
    return;
  }

  const launchId = String(process.env.DINHUTECH_FS_ID || DEFAULT_LAUNCH_ID).trim();
  const apiBase = String(process.env.DINHUTECH_FS_API || DEFAULT_API).replace(/\/$/, "");
  const pollMs = Math.max(
    800,
    Number(process.env.DINHUTECH_POLL_MS || DEFAULT_POLL_MS) || DEFAULT_POLL_MS,
  );
  const auth = String(process.env.DINHUTECH_AUTH || "").trim();
  const seen = new Set<string>();
  let bootstrapped = false;

  const tick = async () => {
    const state = await fetchState(apiBase, launchId, auth);
    if (!state) return;
    const rounds = collectRounds(state);
    if (rounds.length === 0) return;

    // Primeiro tick: injeta histórico recente (até 80) só como cartas.
    // Timestamps escalonados → matching por tempo com a Bridge (IDs diferem).
    if (!bootstrapped) {
      bootstrapped = true;
      const recent = rounds.slice(-80);
      const now = Date.now();
      const ROUND_GAP_MS = 35_000;
      for (let i = 0; i < recent.length; i += 1) {
        const round = recent[i]!;
        const ageFromNewest = recent.length - 1 - i;
        ingestFootballStudioCards(
          {
            ...round,
            at: now - ageFromNewest * ROUND_GAP_MS,
            source: "history",
          },
          { feed: "dinhutech" },
        );
        seen.add(round.gameId);
      }
      console.log(
        `[Football Studio] dinhutech: bootstrap ${recent.length} cartas · launchId ${launchId}`,
      );
      return;
    }

    for (const round of rounds) {
      if (seen.has(round.gameId)) continue;
      seen.add(round.gameId);
      ingestFootballStudioCards(
        { ...round, at: Date.now(), source: "history" },
        { feed: "dinhutech" },
      );
      // Limita set para não crescer sem fim.
      if (seen.size > 500) {
        const drop = [...seen].slice(0, seen.size - 400);
        for (const id of drop) seen.delete(id);
      }
    }
  };

  console.log(
    `[Football Studio] dinhutech poller ON · ${apiBase} · id ${launchId} · ${pollMs}ms`,
  );
  void tick();
  setInterval(() => void tick(), pollMs);
}
