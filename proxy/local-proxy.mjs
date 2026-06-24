// Proxy local — roda no SEU PC (IP brasileiro), contorna geo-block + CORS.
// Uso:
//   node proxy/local-proxy.mjs
// Depois no painel coloque: http://localhost:8787
//
// Endpoints:
//   GET /events                -> repassa para /api/events?...&sportsid=15
//   GET /raw?url=<urlEncoded>  -> repassa qualquer URL (use com cuidado)

import http from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

const PORT = process.env.PORT || 8787;
const UPSTREAM_BASE = "https://bolsadeaposta.bet.br";
const EVENTS_PATH = "/client/api/jumper/feedSports/inplay-info";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function proxyTo(targetUrl, res) {
  const u = new URL(targetUrl);
  const req = httpsRequest(
    {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
        Referer: "https://bolsadeaposta.bet.br/",
        Origin: "https://bolsadeaposta.bet.br",
      },
    },
    (upstream) => {
      const chunks = [];
      upstream.on("data", (c) => chunks.push(c));
      upstream.on("end", () => {
        const body = Buffer.concat(chunks);
        res.writeHead(upstream.statusCode || 502, {
          "Content-Type": upstream.headers["content-type"] || "application/json",
          ...CORS,
        });
        res.end(body);
        console.log(
          `[${new Date().toLocaleTimeString()}] ${upstream.statusCode} ${targetUrl} (${body.length}b)`,
        );
      });
    },
  );
  req.on("error", (err) => {
    console.error("upstream error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json", ...CORS });
    res.end(JSON.stringify({ error: err.message }));
  });
  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...CORS });
    return res.end(JSON.stringify({ ok: true, upstream: UPSTREAM_BASE }));
  }

  if (url.pathname === "/events") {
    const qs = url.search || "";
    return proxyTo(`${UPSTREAM_BASE}${EVENTS_PATH}${qs}`, res);
  }

  if (url.pathname === "/raw") {
    const target = url.searchParams.get("url");
    if (!target) {
      res.writeHead(400, { ...CORS });
      return res.end("missing ?url=");
    }
    return proxyTo(target, res);
  }

  res.writeHead(404, CORS);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`\n  Proxy local rodando em  http://localhost:${PORT}`);
  console.log(`  Teste:                   http://localhost:${PORT}/events\n`);
});
