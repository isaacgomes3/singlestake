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

export const Route = createFileRoute("/api/roulette/strategy-global/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { subscribeStrategyGlobalHub } = await import("@/lib/server/strategyGlobal/broadcast");
        const { subscribeRouletteHub } = await import("@/lib/server/rouletteHub");
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              sseData({ type: "sync", snapshot: getStrategyGlobalSnapshotOrThrow() }),
            );

            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribeGlobal = subscribeStrategyGlobalHub((msg) => {
              controller.enqueue(sseData(msg));
            });
            const unsubscribeRoulette = subscribeRouletteHub(() => {
              /* mantém o hub Pragmatic activo enquanto há cliente strategy-global */
            });

            const onAbort = () => {
              clearInterval(keepaliveTimer);
              unsubscribeGlobal();
              unsubscribeRoulette();
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
