import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyMobileMesaRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/mobile/roleta/$mesaId/um1fator")({
  beforeLoad: ({ params }) => {
    throwLegacyMobileMesaRedirect(params.mesaId);
  },
  component: () => null,
});
