import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  lobbyTableCardFallbackBg,
  lobbyTableCardPhotoStyle,
} from "@/lib/roulette/lobbyTableCardAssets";
import {
  MOBILE_ROULETTE_PROVIDER_LABEL,
  lobbyTableDisplayName,
  resolveMacaoTableIdFromLiveTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import { cn } from "@/lib/utils";

type StrategyOption = {
  id: "dois2fatores" | "um1fator";
  title: string;
  subtitle: string;
  to: "/mobile/roleta/$mesaId/dois2fatores" | "/mobile/roleta/$mesaId/um1fator";
};

function StrategyRow({
  item,
  mesaId,
  pct,
}: {
  item: StrategyOption;
  mesaId: string;
  pct: number | null;
}) {
  return (
    <Link
      to={item.to}
      params={{ mesaId }}
      className="flex items-center gap-3 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-4 py-4 transition active:scale-[0.99] hover:bg-neutral-900"
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-amber-400">{item.title}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{item.subtitle}</p>
        {pct != null ? (
          <p className="mt-2 text-sm text-neutral-400">{pct.toFixed(1)}% nesta sessão</p>
        ) : null}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-600" aria-hidden />
    </Link>
  );
}

type Props = {
  tableId: number;
  doisPct?: number | null;
  umPct?: number | null;
};

export function MobileRouletteStrategiesPage({ tableId, doisPct, umPct }: Props) {
  const mesaId = String(tableId);
  const macaoTableId = resolveMacaoTableIdFromLiveTableIds(getLiveRouletteTableIds());
  const title = lobbyTableDisplayName(tableId, macaoTableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId, macaoTableId);

  const items: StrategyOption[] = [
    {
      id: "dois2fatores",
      title: "2 Fatores",
      subtitle: "Cruzamento ausente nesta mesa",
      to: "/mobile/roleta/$mesaId/dois2fatores",
    },
    {
      id: "um1fator",
      title: "1 Fator",
      subtitle: "Confirmação t1/t2 nesta mesa",
      to: "/mobile/roleta/$mesaId/um1fator",
    },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-black">
      <header className="border-b border-neutral-900 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Link
            to="/mobile"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{title}</p>
            <p className="truncate text-xs text-neutral-500">{MOBILE_ROULETTE_PROVIDER_LABEL}</p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "relative mx-4 mt-4 aspect-[16/9] overflow-hidden rounded-2xl border border-neutral-800/80",
          !photoStyle && "bg-[#0a101c]",
        )}
        style={
          photoStyle
            ? { backgroundImage: photoStyle.backgroundImage, backgroundPosition: photoStyle.backgroundPosition, backgroundSize: "cover" }
            : { background: lobbyTableCardFallbackBg() }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-lg font-bold text-white">{title}</p>
          <p className="text-xs text-neutral-400">Escolha a estratégia</p>
        </div>
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-3 px-4 pb-8">
        {items.map((item) => (
          <li key={item.id}>
            <StrategyRow
              item={item}
              mesaId={mesaId}
              pct={item.id === "dois2fatores" ? (doisPct ?? null) : (umPct ?? null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { rotatingRoomSessionAproveitamentoPct };
