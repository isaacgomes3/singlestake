import { createFileRoute } from "@tanstack/react-router";

import { BackOfficeLayout } from "@/components/back-office/back-office-layout";
import { guardBackOfficeRoute } from "@/lib/auth/guards";

export const Route = createFileRoute("/back-office")({
  beforeLoad: () => {
    guardBackOfficeRoute();
  },
  head: () => ({
    meta: [
      { title: "Back office — singlestake" },
      {
        name: "description",
        content: "Gestão de afiliados, pacotes, rede binária e financeiro.",
      },
    ],
  }),
  component: BackOfficeLayout,
});
