import { createFileRoute } from "@tanstack/react-router";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const enc = new TextEncoder();
const sseKeepalive = enc.encode(": keepalive\n\n");

function sseData(data: unknown): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/damas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lobby = url.searchParams.get("lobby") === "1";
        if (lobby) {
          const { damasGetLobbySlots } = await import("@/lib/server/damasServerState");
          return new Response(JSON.stringify({ slots: damasGetLobbySlots() }), { headers: JSON_HEADERS });
        }

        const roomId = url.searchParams.get("roomId")?.trim() ?? "";
        const secret = url.searchParams.get("secret")?.trim() ?? null;
        const stream = url.searchParams.get("stream") === "1";

        if (!roomId) {
          return new Response(JSON.stringify({ error: "Falta roomId." }), {
            status: 400,
            headers: JSON_HEADERS,
          });
        }

        if (stream) {
          const { damasSubscribeRoom, damasGetState } = await import("@/lib/server/damasServerState");
          const initial = damasGetState(roomId, secret);
          if (!initial.ok) {
            return new Response(JSON.stringify({ error: initial.error }), {
              status: 404,
              headers: JSON_HEADERS,
            });
          }

          const streamOut = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(sseData({ type: "state", state: initial.state }));
              const keep = setInterval(() => {
                try {
                  controller.enqueue(sseKeepalive);
                } catch {
                  clearInterval(keep);
                }
              }, 25_000);
              const unsub = damasSubscribeRoom(roomId, controller);
              request.signal.addEventListener(
                "abort",
                () => {
                  clearInterval(keep);
                  unsub();
                  try {
                    controller.close();
                  } catch {
                    /* */
                  }
                },
                { once: true },
              );
            },
          });

          return new Response(streamOut, { headers: { ...SSE_HEADERS } });
        }

        const { damasGetState } = await import("@/lib/server/damasServerState");
        const r = damasGetState(roomId, secret);
        if (!r.ok) {
          return new Response(JSON.stringify({ error: r.error }), { status: 404, headers: JSON_HEADERS });
        }
        return new Response(JSON.stringify(r.state), { headers: JSON_HEADERS });
      },

      POST: async ({ request }) => {
        const body = ((await readJson(request)) ?? {}) as Record<string, unknown>;
        const action = typeof body.action === "string" ? body.action : "";

        if (action === "create") {
          const { damasCreateRoom } = await import("@/lib/server/damasServerState");
          const hostName = typeof body.hostName === "string" ? body.hostName : "";
          const { roomId, hostSecret } = damasCreateRoom(hostName);
          return new Response(JSON.stringify({ roomId, hostSecret, seat: 0 as const }), {
            headers: JSON_HEADERS,
          });
        }

        if (action === "takeHost") {
          const { damasTakeHostSlot } = await import("@/lib/server/damasServerState");
          const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
          const hostName = typeof body.hostName === "string" ? body.hostName : "";
          if (!roomId) {
            return new Response(JSON.stringify({ error: "Falta roomId." }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          const th = damasTakeHostSlot(roomId, hostName);
          if (!th.ok) {
            return new Response(JSON.stringify({ error: th.error }), { status: 400, headers: JSON_HEADERS });
          }
          return new Response(JSON.stringify({ hostSecret: th.hostSecret, seat: 0 as const }), {
            headers: JSON_HEADERS,
          });
        }

        if (action === "join") {
          const { damasJoinRoom } = await import("@/lib/server/damasServerState");
          const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
          const guestName = typeof body.guestName === "string" ? body.guestName : "";
          if (!roomId) {
            return new Response(JSON.stringify({ error: "Falta roomId." }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          const j = damasJoinRoom(roomId, guestName);
          if (!j.ok) {
            return new Response(JSON.stringify({ error: j.error }), { status: 400, headers: JSON_HEADERS });
          }
          return new Response(JSON.stringify({ guestSecret: j.guestSecret, seat: 1 as const }), {
            headers: JSON_HEADERS,
          });
        }

        if (action === "move") {
          const { damasTryMove } = await import("@/lib/server/damasServerState");
          const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
          const secret = typeof body.secret === "string" ? body.secret : "";
          const from = body.from as unknown;
          const to = body.to as unknown;
          if (!roomId || !secret || !Array.isArray(from) || !Array.isArray(to) || from.length < 2 || to.length < 2) {
            return new Response(JSON.stringify({ error: "Dados incompletos." }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          const fr = Number(from[0]);
          const fc = Number(from[1]);
          const tr = Number(to[0]);
          const tc = Number(to[1]);
          if (![fr, fc, tr, tc].every((n) => Number.isInteger(n))) {
            return new Response(JSON.stringify({ error: "Coordenadas inválidas." }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          const m = damasTryMove(roomId, secret, { r: fr, c: fc }, { r: tr, c: tc });
          if (!m.ok) {
            return new Response(JSON.stringify({ error: m.error, state: m.state }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
          return new Response(JSON.stringify({ state: m.state }), { headers: JSON_HEADERS });
        }

        return new Response(JSON.stringify({ error: "Ação desconhecida." }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
