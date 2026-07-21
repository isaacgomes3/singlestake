/**
 * Feeder Football Studio via DinhuTech (poll do estado ao vivo).
 *
 * O DinhuTech já mantém worker 24h no Evolution e expõe:
 *   GET https://api.dinhutech.com.br/api/v1/analyzers/football-studio/{launchId}/state
 *
 * Campos úteis:
 *   - cards[] / currentCards → Dragon=Casa, Tiger=Visitante (código AH/9S…)
 *   - history[] → winner Dragon|Tiger|Tie
 *   - serializedHistory → letras do jogo (C=Casa, V=Visitante, E=Empate)
 *
 * Este script faz POST no hub local:
 *   POST {hub}/api/evolution/football-studio-cards
 *
 * Uso:
 *   npm run feeder:football-studio:dinhutech
 *   npm run feeder:football-studio:dinhutech -- --id 48694
 *
 * Env:
 *   DINHUTECH_FS_ID / --id       launchId (default 48694)
 *   DINHUTECH_FS_API / --api     base API (default https://api.dinhutech.com.br)
 *   FS_FEEDER_HUB / --hub        http://127.0.0.1:5173
 *   FS_FEEDER_TOKEN / --token    FOOTBALL_STUDIO_INGEST_TOKEN
 *   DINHUTECH_POLL_MS / --poll   intervalo ms (default 1500)
 *   DINHUTECH_AUTH / --auth      Cookie ou Bearer opcional (se a API exigir)
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  parseTopCardCode,
  type TopCardParsedCard,
  type TopCardSide,
} from "../src/lib/evolution/topCardEvoParser";

type DinhuCardSide = { card?: string; score?: number };
type DinhuCardRound = {
  gameId?: string;
  gameNumber?: string;
  Dragon?: DinhuCardSide;
  Tiger?: DinhuCardSide;
};

type DinhuState = {
  type?: string;
  gameId?: string;
  launchId?: string;
  currentCards?: DinhuCardRound | null;
  cards?: Array<DinhuCardRound | null>;
  history?: Array<{ winner?: string; tigerScore?: number; dragonScore?: number }>;
  serializedHistory?: string;
  source?: string;
  workerStatus?: string;
  available?: boolean;
  stale?: boolean;
};

type FeederConfig = {
  launchId: string;
  apiBase: string;
  hubBase: string;
  ingestToken: string;
  pollMs: number;
  auth: string;
  lettersPath: string;
};

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function resolveConfig(): FeederConfig {
  const launchId = String(
    argValue("--id") || process.env.DINHUTECH_FS_ID || "48694",
  ).trim();
  const apiBase = (
    argValue("--api") ||
    process.env.DINHUTECH_FS_API ||
    "https://api.dinhutech.com.br"
  ).replace(/\/$/, "");
  const hubBase = (
    argValue("--hub") ||
    process.env.FS_FEEDER_HUB ||
    "http://127.0.0.1:5173"
  ).replace(/\/$/, "");
  const ingestToken =
    argValue("--token") ||
    process.env.FS_FEEDER_TOKEN ||
    process.env.FOOTBALL_STUDIO_INGEST_TOKEN ||
    "";
  const pollMs = Math.max(
    500,
    Number(argValue("--poll") || process.env.DINHUTECH_POLL_MS || 1500) || 1500,
  );
  const auth = String(argValue("--auth") || process.env.DINHUTECH_AUTH || "").trim();
  const lettersPath = path.resolve(
    process.env.DINHUTECH_LETTERS_PATH || "./data/football-studio/dinhutech-letters.txt",
  );
  return { launchId, apiBase, hubBase, ingestToken, pollMs, auth, lettersPath };
}

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

  // Com cartas, o resultado vem dos scores.
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

async function fetchState(config: FeederConfig): Promise<DinhuState | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "singlestake-dinhutech-feeder/1.0",
  };
  if (config.auth) {
    if (/^Bearer\s+/i.test(config.auth) || config.auth.includes("=")) {
      if (/^Bearer\s+/i.test(config.auth)) headers.Authorization = config.auth;
      else headers.Cookie = config.auth;
    } else {
      headers.Authorization = `Bearer ${config.auth}`;
    }
  }
  const url = `${config.apiBase}/api/v1/analyzers/football-studio/${config.launchId}/state`;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`[dinhutech] HTTP ${response.status} em ${url}`);
      return null;
    }
    return (await response.json()) as DinhuState;
  } catch (error) {
    console.warn(
      "[dinhutech] fetch falhou:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function postCards(
  config: FeederConfig,
  body: Record<string, unknown>,
): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.ingestToken) headers["x-fs-ingest-token"] = config.ingestToken;
  try {
    const response = await fetch(`${config.hubBase}/api/evolution/football-studio-cards`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[dinhutech] hub HTTP ${response.status}: ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      "[dinhutech] hub offline:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

async function fetchHubHead(config: FeederConfig): Promise<{
  lastGameId: string | null;
  cardsWithSuits: number;
} | null> {
  try {
    const response = await fetch(`${config.hubBase}/api/evolution/football-studio`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      lastCards?: { gameId?: string };
      cardsWithSuits?: number;
    };
    return {
      lastGameId: data.lastCards?.gameId ? String(data.lastCards.gameId) : null,
      cardsWithSuits: Number(data.cardsWithSuits) || 0,
    };
  } catch {
    return null;
  }
}

async function pushRecent(
  config: FeederConfig,
  rounds: Array<NonNullable<ReturnType<typeof roundFromDinhu>>>,
  seen: Set<string>,
  label: string,
) {
  const recent = rounds.slice(-40);
  let sent = 0;
  for (const round of recent) {
    if (!round) continue;
    const ok = await postCards(config, {
      ...round,
      at: Date.now(),
      source: "dinhutech",
    });
    if (ok) {
      seen.add(round.gameId);
      sent += 1;
    }
  }
  if (sent > 0) {
    console.log(`[dinhutech] ${label}: ${sent} rodadas → hub`);
  }
}

async function saveLetters(config: FeederConfig, letters: string) {
  try {
    await mkdir(path.dirname(config.lettersPath), { recursive: true });
    await writeFile(
      config.lettersPath,
      `${letters}\n# atualizado ${new Date().toISOString()}\n`,
      "utf8",
    );
  } catch {
    // ficheiro é cosmético
  }
}

function collectRounds(state: DinhuState): Array<NonNullable<ReturnType<typeof roundFromDinhu>>> {
  const cards = (state.cards ?? []).filter(Boolean) as DinhuCardRound[];
  const rounds: Array<NonNullable<ReturnType<typeof roundFromDinhu>>> = [];
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

async function main() {
  const config = resolveConfig();
  console.log("[dinhutech] launchId:", config.launchId);
  console.log("[dinhutech] api:", config.apiBase);
  console.log("[dinhutech] hub:", config.hubBase);
  console.log("[dinhutech] poll:", `${config.pollMs}ms`);
  console.log("[dinhutech] letras →", config.lettersPath);
  console.log("[dinhutech] C=Casa · V=Visitante · E=Empate");
  console.log("[dinhutech] Ctrl+C para parar (mantém a correr 24h)");

  const seen = new Set<string>();
  let lastLetters = "";
  let lastPushedId: string | null = null;

  const tick = async () => {
    const state = await fetchState(config);
    if (!state) return;

    const rounds = collectRounds(state);
    if (rounds.length === 0) {
      if (state.available === false) {
        console.warn(
          "[dinhutech] sem cartas:",
          (state as { unavailableReason?: string }).unavailableReason ?? state.workerStatus,
        );
      }
      return;
    }

    const letters = String(state.serializedHistory ?? "").trim();
    if (letters && letters !== lastLetters) {
      lastLetters = letters;
      await saveLetters(config, letters);
      const tail = letters.slice(-40);
      console.log(
        `[dinhutech] letras (${letters.length}): …${tail} · worker=${state.workerStatus ?? "?"} source=${state.source ?? "?"}`,
      );
    }

    const newest = rounds[rounds.length - 1]!;
    const hub = await fetchHubHead(config);
    const hubBehind = !hub || hub.lastGameId !== newest.gameId;
    const needFullSync = !hub || hub.cardsWithSuits < 15;

    // Hub vazio / fino (HMR) → reenvia as últimas 40.
    if (needFullSync) {
      await pushRecent(config, rounds, seen, "re-sync hub vazio");
      lastPushedId = newest.gameId;
      return;
    }

    if (!hubBehind) {
      seen.add(newest.gameId);
      lastPushedId = newest.gameId;
      return;
    }

    // Só 1 (ou poucas) rodadas atrás → posta a mais recente.
    if (newest.gameId === lastPushedId || seen.has(newest.gameId)) {
      // Hub diz outra head — força push mesmo assim.
    }
    const ok = await postCards(config, {
      ...newest,
      at: Date.now(),
      source: "dinhutech",
    });
    if (!ok) return;
    seen.add(newest.gameId);
    lastPushedId = newest.gameId;
    if (seen.size > 500) {
      const keep = [...seen].slice(-300);
      seen.clear();
      for (const id of keep) seen.add(id);
    }
    console.log(
      `[dinhutech] ${newest.home.label}/${newest.away.label} → ${newest.winner} (${newest.gameId})`,
    );
  };

  await tick();
  const timer = setInterval(() => void tick(), config.pollMs);

  const shutdown = () => {
    clearInterval(timer);
    console.log("[dinhutech] a encerrar…");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[dinhutech] fatal:", error);
  process.exit(1);
});
