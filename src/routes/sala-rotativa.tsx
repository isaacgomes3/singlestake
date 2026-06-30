import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";

export const Route = createFileRoute("/sala-rotativa")({
  beforeLoad: () => {
    guardAutomationWorkspaceRoute("/sala-rotativa-dois-fatores");
    requireAuth("/sala-rotativa-dois-fatores");
    throw redirect({ to: "/sala-rotativa-dois-fatores" });
  },
  component: () => null,
});
