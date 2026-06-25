import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAuth } from "@/lib/auth/guards";

export const Route = createFileRoute("/sala-rotativa")({
  beforeLoad: () => {
    requireAuth("/sala-rotativa-um-fator");
    throw redirect({ to: "/sala-rotativa-um-fator" });
  },
  component: () => null,
});
