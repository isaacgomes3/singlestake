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

export const Route = createFileRoute("/api/evolution/football-studio/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { waitForFootballStudioDaemon } = await import(
          "@/lib/server/footballStudio/daemon"
        );
        const { subscribeFootballStudioHub } = await import("@/lib/server/footballStudio/hub");
        await waitForFootballStudioDaemon(8_000);

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const keepaliveTimer = setInterval(() => {
              try {
                controller.enqueue(sseKeepalive);
              } catch {
                clearInterval(keepaliveTimer);
              }
            }, SSE_KEEPALIVE_MS);

            const unsubscribe = subscribeFootballStudioHub((msg) => {
              try {
                controller.enqueue(sseData(msg));
              } catch {
                clearInterval(keepaliveTimer);
                unsubscribe();
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
