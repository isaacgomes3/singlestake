import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { closeUserSession } = await import("@/lib/server/auth/http");
        return closeUserSession(request);
      },
    },
  },
});
