import { createFileRoute } from "@tanstack/react-router";

import { RouletteLobbyPage } from "@/components/roulette-lobby-page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lobby — Roletas ao vivo" },
      {
        name: "description",
        content:
          "Lobby com as mesas ao vivo configuradas e a numeração em tempo real (Pragmatic DGA via SSE).",
      },
    ],
  }),
  component: RouletteLobbyPage,
});
