import { createFileRoute } from "@tanstack/react-router";

import { MobileRouletteGridPage } from "@/components/mobile-app/mobile-roulette-grid";

export const Route = createFileRoute("/mobile/")({
  head: () => ({
    meta: [
      { title: "Jogos — Modo mobile" },
      { name: "description", content: "Escolha a roleta ao vivo." },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: MobileRouletteGridPage,
});
