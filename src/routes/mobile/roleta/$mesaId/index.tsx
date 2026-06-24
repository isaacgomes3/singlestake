import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  MobileRouletteStrategiesPage,
  rotatingRoomSessionAproveitamentoPct,
} from "@/components/mobile-app/mobile-roulette-strategies";
import { useMobileTableSetup } from "@/hooks/useMobileTableSetup";
import { readDoisFatoresCrossingSessionStats } from "@/lib/roulette/doisFatoresCrossingStrategy";
import { MOBILE_ROULETTE_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";
import { readUmFatorSessionStats } from "@/lib/roulette/umFatorCrossingStrategy";

function parseMesaId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export const Route = createFileRoute("/mobile/roleta/$mesaId/")({
  beforeLoad: ({ params }) => {
    const tableId = parseMesaId(params.mesaId);
    if (tableId == null || !MOBILE_ROULETTE_FIXED_TABLE_IDS.includes(tableId)) {
      throw redirect({ to: "/mobile" });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Roleta ${params.mesaId} — Modo mobile` },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: MobileRouletteDetailPage,
});

function MobileRouletteDetailPage() {
  const { mesaId: mesaRaw } = Route.useParams();
  const tableId = parseMesaId(mesaRaw)!;
  useMobileTableSetup(tableId);

  const doisStats = readDoisFatoresCrossingSessionStats(tableId);
  const umStats = readUmFatorSessionStats(tableId);

  return (
    <MobileRouletteStrategiesPage
      tableId={tableId}
      doisPct={rotatingRoomSessionAproveitamentoPct(doisStats)}
      umPct={rotatingRoomSessionAproveitamentoPct(umStats)}
    />
  );
}
