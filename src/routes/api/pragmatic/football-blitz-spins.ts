import { createFileRoute } from "@tanstack/react-router";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const SSE_KEEPALIVE_MS = 25_000;
const sseKeepalive = new TextEncoder().encode(": keepalive\n\n");

function sseData(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const Route = createFileRoute("/api/pragmatic/football-blitz-spins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log("[Football Blitz] GET /api/pragmatic/football-blitz-spins — SSE");
        const { subscribeDgaFootballBlitzHub } = await import("@/lib/server/dgaFootballBlitzHub");
        const { DGA_FOOTBALL_BLITZ_TABLE_KEYS } = await import(
          "@/lib/pragmatic/dgaFootballBlitzConstants"
        );

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              sseData({ type: "ready", ok: true, tableKeys: [...DGA_FOOTBALL_BLITZ_TABLE_KEYS] }),
            );

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribe = subscribeDgaFootballBlitzHub((msg) => {
              if (msg.type === "round") {
                controller.enqueue(
                  sseData({
                    type: "round",
                    tableKey: msg.tableKey,
                    gameId: msg.round.gameId,
                    winner: msg.round.winner,
                    winningNumber: msg.round.winningNumber,
                    scoreDiff: msg.round.scoreDiff,
                    time: msg.round.time,
                    replay: msg.replay === true,
                  }),
                );
              } else if (msg.type === "round-replay-batch") {
                controller.enqueue(
                  sseData({
                    type: "round-replay-batch",
                    tableKey: msg.tableKey,
                    rounds: msg.rounds.map((r) => ({
                      gameId: r.gameId,
                      winner: r.winner,
                      winningNumber: r.winningNumber,
                      scoreDiff: r.scoreDiff,
                      time: r.time,
                    })),
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
                /* */
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
