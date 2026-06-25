import { createFileRoute } from "@tanstack/react-router";

import { BackOfficeSuportePage } from "@/components/back-office/back-office-suporte-page";

export const Route = createFileRoute("/back-office/suporte")({
  head: () => ({
    meta: [{ title: "Suporte — Back office" }],
  }),
  component: BackOfficeSuportePage,
});
