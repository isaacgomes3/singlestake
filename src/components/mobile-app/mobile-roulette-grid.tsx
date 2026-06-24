import { Link } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  lobbyTableCardFallbackBg,
  lobbyTableCardPhotoStyle,
} from "@/lib/roulette/lobbyTableCardAssets";
import {
  MOBILE_ROULETTE_FIXED_TABLE_IDS,
  MOBILE_ROULETTE_PROVIDER_LABEL,
  lobbyTableDisplayName,
  resolveMacaoTableIdFromLiveTableIds,
  resolveMobileRouletteTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import { cn } from "@/lib/utils";

function MobileRouletteCard({ tableId, macaoTableId }: { tableId: number; macaoTableId: number }) {
  const title = lobbyTableDisplayName(tableId, macaoTableId);
  const photoStyle = lobbyTableCardPhotoStyle(tableId, macaoTableId);
  const showBrFlag = tableId === 237;

  return (
    <Link
      to="/mobile/roleta/$mesaId"
      params={{ mesaId: String(tableId) }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800/90 bg-neutral-900/80 transition active:scale-[0.98] hover:border-amber-500/30"
    >
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden bg-cover bg-center bg-no-repeat",
          !photoStyle && "bg-[#0a101c]",
        )}
        style={
          photoStyle
            ? { backgroundImage: photoStyle.backgroundImage, backgroundPosition: photoStyle.backgroundPosition }
            : { background: lobbyTableCardFallbackBg() }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {showBrFlag ? (
          <span className="absolute right-2 top-2 text-base" aria-label="Brasil">
            🇧🇷
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-bold text-white group-hover:text-amber-100">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-neutral-500">{MOBILE_ROULETTE_PROVIDER_LABEL}</p>
      </div>
    </Link>
  );
}

export function MobileRouletteGridPage() {
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    const sync = () => setConfigTick((x) => x + 1);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
  }, []);

  const { tableIds, macaoTableId } = useMemo(() => {
    void configTick;
    const live = getLiveRouletteTableIds();
    const macao = resolveMacaoTableIdFromLiveTableIds(live);
    const resolved = resolveMobileRouletteTableIds(live);
    return {
      tableIds: resolved.length > 0 ? resolved : [...MOBILE_ROULETTE_FIXED_TABLE_IDS],
      macaoTableId: macao,
    };
  }, [configTick]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-2xl font-black text-transparent">
            Roletas
          </p>
          <h1 className="mt-2 text-lg font-bold text-white">Roletas mais acessadas</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300">
          <CircleDot className="h-3.5 w-3.5" aria-hidden />
          Ao vivo
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {tableIds.map((id) => (
          <MobileRouletteCard key={id} tableId={id} macaoTableId={macaoTableId} />
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-neutral-600">
        Cada roleta com sinais 2 Fatores e 1 Fator — independentes da sala rotativa.
      </p>
    </div>
  );
}
