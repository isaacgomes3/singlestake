import { createFileRoute, redirect } from "@tanstack/react-router";

import { CasinoMesaIce2fWorkspace } from "@/components/casino-mesa-ice2f-workspace";
import { parseMesaSearch } from "@/lib/back-office/legacy-redirects";
import { ROULETTE_MACAO_TABLE_ID } from "@/lib/roulette/lobbyTables";

type CasinoMesaSearch = {
  mesa?: number;
};

export const Route = createFileRoute("/casino-mesa")({
  validateSearch: (search: Record<string, unknown>): CasinoMesaSearch => {
    const mesa = parseMesaSearch(search);
    return mesa != null ? { mesa } : {};
  },
  beforeLoad: ({ search }) => {
    if (search.mesa == null || search.mesa <= 0) {
      throw redirect({
        to: "/casino-mesa",
        search: { mesa: ROULETTE_MACAO_TABLE_ID },
        replace: true,
      });
    }
  },
  head: ({ match }) => ({
    meta: [
      {
        title: `Mesa ${match.search.mesa ?? ROULETTE_MACAO_TABLE_ID} — Cruzamento 2F`,
      },
    ],
  }),
  component: CasinoMesaRoute,
});

function CasinoMesaRoute() {
  const { mesa } = Route.useSearch();
  return <CasinoMesaIce2fWorkspace tableId={mesa ?? ROULETTE_MACAO_TABLE_ID} />;
}
