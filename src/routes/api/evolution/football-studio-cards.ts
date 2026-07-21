import { createFileRoute } from "@tanstack/react-router";

import type { TopCardParsedCard, TopCardSide } from "@/lib/evolution/topCardEvoParser";
import { formatTopCardLabel, suitLabelFor } from "@/lib/evolution/topCardEvoParser";
import { isFootballStudioSide } from "@/lib/server/footballStudio/types";

function ingestAuthorized(request: Request): boolean {
  const expected = (process.env.FOOTBALL_STUDIO_INGEST_TOKEN || "").trim();
  if (!expected) return true;
  const header = request.headers.get("x-fs-ingest-token") || request.headers.get("authorization");
  if (!header) return false;
  if (header === expected) return true;
  if (header.startsWith("Bearer ") && header.slice(7).trim() === expected) return true;
  return false;
}

function parseCard(raw: unknown): TopCardParsedCard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = String(o.code ?? "").trim().toUpperCase();
  let suit = String(o.suit ?? "").trim().toUpperCase();
  let rank = String(o.rank ?? "").trim().toUpperCase();
  if (!suit && code && "HSDC".includes(code.slice(-1))) suit = code.slice(-1);
  if (!rank && code) {
    rank = code.slice(0, -1);
    if (rank === "T") rank = "10";
  }
  if (!rank) {
    const fromLabel = String(o.label ?? "").match(/^(10|[2-9]|[AJQK])/i);
    rank = fromLabel ? fromLabel[1]!.toUpperCase() : "";
  }
  if (!rank && !code && !String(o.label ?? "").trim()) return null;
  const suitKey = (suit === "H" || suit === "S" || suit === "D" || suit === "C" ? suit : "H") as
    | "H"
    | "S"
    | "D"
    | "C";
  const label = formatTopCardLabel({ rank, suit: suitKey, code, label: String(o.label ?? "") });
  return {
    code: code || `${rank}${suitKey}`,
    rank: rank || label.replace(/[^\dAJQK]/gi, ""),
    suit: suitKey,
    suitLabel: suitLabelFor(suitKey),
    score: Number(o.score) || 0,
    label: label || code || rank,
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, x-fs-ingest-token, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonWithCors(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return Response.json(data, { ...init, headers });
}

export const Route = createFileRoute("/api/evolution/football-studio-cards")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        }),
      POST: async ({ request }) => {
        if (!ingestAuthorized(request)) {
          return jsonWithCors({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { waitForFootballStudioDaemon } = await import(
          "@/lib/server/footballStudio/daemon"
        );
        const { ingestFootballStudioCards, ingestFootballStudioEvoText } = await import(
          "@/lib/server/footballStudio/hub"
        );
        await waitForFootballStudioDaemon(8_000);

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== "object") {
          return jsonWithCors({ ok: false, error: "JSON inválido" }, { status: 400 });
        }

        if (typeof body.text === "string" && body.text.trim()) {
          const allowed = String(process.env.FOOTBALL_STUDIO_CARDS_SOURCE ?? "dinhutech")
            .trim()
            .toLowerCase();
          if (allowed === "dinhutech") {
            return jsonWithCors({
              ok: true,
              ignored: true,
              reason: "Hub em modo só DinhuTech — ignore WS Obs",
            });
          }
          const snap = ingestFootballStudioEvoText(
            body.text,
            typeof body.at === "number" ? body.at : Date.now(),
          );
          if (!snap) {
            return jsonWithCors({ ok: false, error: "Mensagem WS sem cartas" }, { status: 422 });
          }
          return jsonWithCors(snap);
        }

        const gameId = String(body.gameId ?? "").trim();
        const winner = body.winner;
        const home = parseCard(body.home);
        const away = parseCard(body.away);
        if (!gameId || !isFootballStudioSide(winner) || !home || !away) {
          return jsonWithCors(
            { ok: false, error: "Envie gameId, winner, home e away com label/code" },
            { status: 400 },
          );
        }

        const feed = String(body.source ?? body.feed ?? "").trim().toLowerCase() || "unknown";
        const snap = ingestFootballStudioCards(
          {
            gameId,
            gameNumber: typeof body.gameNumber === "string" ? body.gameNumber : undefined,
            winner: winner as TopCardSide,
            home,
            away,
            homeScore: Number(body.homeScore) || home.score,
            awayScore: Number(body.awayScore) || away.score,
            source: "cardDealt",
            at: typeof body.at === "number" ? body.at : Date.now(),
          },
          { feed },
        );
        return jsonWithCors(snap);
      },
    },
  },
});
