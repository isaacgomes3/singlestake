import { createFileRoute, redirect } from "@tanstack/react-router";

import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";

export const Route = createFileRoute("/casino-mesa")({
  beforeLoad: () => {
    throw redirect({ to: BACK_OFFICE_PATHS.salaRotativa, replace: true });
  },
  component: () => null,
});
