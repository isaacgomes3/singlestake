import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/efi-pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody } = await import("@/lib/server/auth/http");
        const { handleEfiPixWebhook } = await import("@/lib/server/finance/package-pix");

        const body = await readJsonBody<Record<string, unknown>>(request);
        await handleEfiPixWebhook(body);
        return jsonResponse({ ok: true });
      },
    },
  },
});
