import { createFileRoute } from "@tanstack/react-router";

import { BackOfficeOverviewPage } from "@/components/back-office/back-office-overview";

export const Route = createFileRoute("/back-office/")({
  head: () => ({
    meta: [{ title: "Visão geral — Back office" }],
  }),
  component: BackOfficeOverviewPage,
});
