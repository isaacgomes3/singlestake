import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyBackOfficeRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/mobile/perfil")({
  beforeLoad: () => {
    throwLegacyBackOfficeRedirect();
  },
  component: () => null,
});
