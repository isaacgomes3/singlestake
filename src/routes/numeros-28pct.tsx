import { createFileRoute } from "@tanstack/react-router";

import { throwLegacyTableRedirect } from "@/lib/back-office/legacy-redirects";

export const Route = createFileRoute("/numeros-28pct")({
  validateSearch: (search: Record<string, unknown>): { mesa?: number } => {
    const raw = search.mesa;
    if (raw === undefined || raw === null || raw === "") return {};
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isInteger(n) || n <= 0) return {};
    return { mesa: n };
  },
  beforeLoad: ({ search }) => {
    throwLegacyTableRedirect(search);
  },
  component: () => null,
});
