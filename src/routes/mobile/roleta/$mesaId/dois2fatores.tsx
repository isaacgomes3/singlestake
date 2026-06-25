import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyMobileMesaRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/mobile/roleta/$mesaId/dois2fatores")({
  beforeLoad: ({ params }) => {
    throwLegacyMobileMesaRedirect(params.mesaId);
  },
  component: () => null,
});
