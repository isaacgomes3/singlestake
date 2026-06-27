import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";

export const Route = createFileRoute("/sala-rotativa")({
  beforeLoad: () => {
    guardAutomationWorkspaceRoute("/sala-rotativa-um-fator");
    requireAuth("/sala-rotativa-um-fator");
    throw redirect({ to: "/sala-rotativa-um-fator" });
  },
  component: () => null,
});
