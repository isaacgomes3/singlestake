import { createFileRoute } from "@tanstack/react-router";

import { MobileProfilePage } from "@/components/mobile-app/mobile-profile-page";

export const Route = createFileRoute("/mobile/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Modo mobile" },
      { name: "description", content: "Perfil, saldo e definições da conta." },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: MobileProfilePage,
});
