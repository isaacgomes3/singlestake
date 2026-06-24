import { createFileRoute } from "@tanstack/react-router";

const UPSTREAM =
  "https://bolsadeaposta.bet.br/client/api/jumper/feedSports/inplay-info";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export const Route = createFileRoute("/api/events")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = UPSTREAM + (url.search || "");
        try {
          const upstream = await fetch(target, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "pt-BR,pt;q=0.9",
              Referer: "https://bolsadeaposta.bet.br/",
              Origin: "https://bolsadeaposta.bet.br",
            },
          });
          const body = await upstream.text();
          return new Response(body, {
            status: upstream.status,
            headers: {
              "Content-Type":
                upstream.headers.get("content-type") || "application/json",
              ...CORS,
            },
          });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: e?.message || String(e) }),
            { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
          );
        }
      },
    },
  },
});
