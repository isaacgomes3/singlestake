import { createFileRoute } from "@tanstack/react-router";

import { CasinoMesaUmFatorWorkspace } from "@/components/casino-mesa-um-fator-workspace";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";
import { resolveRuas9ViewTableId } from "@/lib/roulette/lobbyTables";

export const Route = createFileRoute("/casino-mesa")({
  beforeLoad: ({ search }) => {
    guardAutomationWorkspaceRoute("/casino-mesa", search);
    requireAuth("/casino-mesa");
  },
  validateSearch: (search: Record<string, unknown>): { mesa?: number; parentOrigin?: string } => {
    const out: { mesa?: number; parentOrigin?: string } = {};
    const raw = search.mesa;
    if (raw !== undefined && raw !== null && raw !== "") {
      const n = typeof raw === "number" ? raw : Number(String(raw));
      if (Number.isInteger(n) && n > 0) out.mesa = n;
    }
    const po = search.parentOrigin;
    if (typeof po === "string" && po.trim()) out.parentOrigin = po.trim();
    return out;
  },
  head: ({ search }) => {
    const tableId = resolveRuas9ViewTableId(search.mesa);
    return {
      meta: [
        { title: `Casino · Mesa ${tableId} · 1 Fator` },
        {
          name: "description",
          content: "Mesa do casino com iframe, gatilhos e indicações 1 Fator.",
        },
      ],
    };
  },
  component: CasinoMesaPage,
});

function CasinoMesaPage() {
  const { mesa } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);
  return <CasinoMesaUmFatorWorkspace tableId={viewTableId} />;
}
