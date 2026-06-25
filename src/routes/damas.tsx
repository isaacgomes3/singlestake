import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyBackOfficeRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/damas")({
  beforeLoad: () => {
    throwLegacyBackOfficeRedirect();
  },
  component: () => null,
});
