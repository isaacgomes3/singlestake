import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyCassinoRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/cassino")({
  beforeLoad: () => {
    throwLegacyCassinoRedirect();
  },
  component: () => null,
});
