import { createFileRoute } from "@tanstack/react-router";

import { AccountActivationPage } from "@/components/auth/account-activation-page";

export const Route = createFileRoute("/activar-conta")({
  head: () => ({
    meta: [
      { title: "Activar conta — Pacote Start" },
      {
        name: "description",
        content: "Pague o Pacote Start R$ 50 via PIX para activar o acesso ao back office.",
      },
    ],
  }),
  component: AccountActivationPage,
});
