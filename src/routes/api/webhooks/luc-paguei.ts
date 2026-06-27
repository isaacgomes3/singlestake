import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/luc-paguei")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody } = await import("@/lib/server/auth/http");
        const { handleLucPagueiWebhook } = await import("@/lib/server/finance/luc-paguei-webhook");

        try {
          const body = await readJsonBody<unknown>(request);
          await handleLucPagueiWebhook(body);
        } catch (error) {
          console.error("[luc-paguei webhook]", error);
        }

        return jsonResponse({ ok: true });
      },
    },
  },
});
