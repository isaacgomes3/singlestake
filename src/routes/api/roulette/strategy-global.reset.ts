import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/roulette/strategy-global/reset")({
  server: {
    handlers: {
      POST: async () => {
        /** Caixa global da empresa — não pode ser reiniciada pela UI nem por utilizadores. */
        return Response.json(
          {
            ok: false,
            error:
              "O caixa de automação global é partilhado pelo sistema e não pode ser reiniciado.",
          },
          { status: 403 },
        );
      },
    },
  },
});
