import { createFileRoute } from "@tanstack/react-router";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** Comentario SSE (ignorado pelo EventSource) — evita intermediarios fecharem o stream por inactividade. */
const SSE_KEEPALIVE_MS = 25_000;
const sseKeepalive = new TextEncoder().encode(": keepalive\n\n");

/** SSE so com linhas `data:` (JSON com campo `type`) — compativel com todos os EventSource. */
function sseData(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const Route = createFileRoute("/api/roulette/spins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        ensureRouletteHubDaemon();

        console.log("[Roleta] GET /api/roulette/spins — cliente SSE");
        const { subscribeRouletteHub } = await import("@/lib/server/rouletteHub");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const tableIds = parseRouletteTableIdsFromEnv();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(sseData({ type: "ready", ok: true, tableIds }));

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribe = subscribeRouletteHub((msg) => {
              if (msg.type === "spin") {
                controller.enqueue(
                  sseData({
                    type: "spin",
                    number: msg.spin.number,
                    gameId: msg.spin.gameId,
                    replay: msg.replay === true,
                  }),
                );
              } else if (msg.type === "spin-replay-batch") {
                controller.enqueue(
                  sseData({
                    type: "spin-replay-batch",
                    spins: msg.spins.map((s) => ({ number: s.number, gameId: s.gameId })),
                  }),
                );
              } else {
                controller.enqueue(
                  sseData({
                    type: "status",
                    state: msg.state,
                    message: msg.message,
                  }),
                );
              }
            });

            const onAbort = () => {
              clearInterval(keepaliveTimer);
              unsubscribe();
              try {
                controller.close();
              } catch {
                /* já fechado */
              }
            };

            request.signal.addEventListener("abort", onAbort, { once: true });
            if (request.signal.aborted) onAbort();
          },
        });

        return new Response(stream, { headers: { ...SSE_HEADERS } });
      },
    },
  },
});
