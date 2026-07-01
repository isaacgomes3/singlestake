import { createFileRoute, redirect } from "@tanstack/react-router";

import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";

export const Route = createFileRoute("/football-blitz")({
  beforeLoad: () => {
    throw redirect({ to: BACK_OFFICE_PATHS.home, replace: true });
  },
  component: () => null,
});
