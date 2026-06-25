import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyTableRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/smart-move")({
  beforeLoad: ({ search }) => {
    throwLegacyTableRedirect(search);
  },
  component: () => null,
});
