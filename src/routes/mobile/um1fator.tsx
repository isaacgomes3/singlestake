import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyBackOfficeRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/mobile/um1fator")({
  beforeLoad: () => {
    throwLegacyBackOfficeRedirect();
  },
  component: () => null,
});
