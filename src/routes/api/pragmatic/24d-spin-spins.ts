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

export const Route = createFileRoute("/api/pragmatic/24d-spin-spins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log("[24D Spin] GET /api/pragmatic/24d-spin-spins — SSE");
        const { subscribeDga24dSpinHub } = await import("@/lib/server/dga24dSpinHub");
        const { parseDga24dSpinTableKeyFromEnv } = await import("@/lib/server/dga24dSpinSocket");
        const tableKey = parseDga24dSpinTableKeyFromEnv();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(sseData({ type: "ready", ok: true, tableKey }));

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribe = subscribeDga24dSpinHub((msg) => {
              if (msg.type === "spin") {
                controller.enqueue(
                  sseData({
                    type: "spin",
                    number: msg.spin.number,
                    color: msg.spin.color,
                    gameId: msg.spin.gameId,
                    replay: msg.replay === true,
                  }),
                );
              } else if (msg.type === "spin-replay-batch") {
                controller.enqueue(
                  sseData({
                    type: "spin-replay-batch",
                    spins: msg.spins.map((s) => ({
                      number: s.number,
                      color: s.color,
                      gameId: s.gameId,
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
