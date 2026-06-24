import { useEffect, useState } from "react";

import {
  DGA_24D_SPIN_HISTORY_CHANGED_EVENT,
  readDga24dSpinHistory,
  type Dga24dSpinStored,
} from "@/lib/pragmatic/dga24dSpinHistory";
import { DGA_24D_SPIN_DEFAULT_TABLE_KEY } from "@/lib/pragmatic/dga24dSpinConstants";
import { cn } from "@/lib/utils";

/** Igual ao lobby das roletas (`LOBBY_HISTORY_LEN`). */
const DISPLAY_LEN = 7;

/** Fundo do cartão 24D Spin (lobby). */
const DGA_24D_LOBBY_BG = "/lobby/24d-spin-card.png";

/** Mesmas dimensões de célula que `cellClass` nas roletas do lobby (`roulette-lobby-page`). */
function cellClass(spin: Dga24dSpinStored, highlight: boolean): string {
  const base =
    "inline-flex h-5 min-w-[1.15rem] shrink-0 items-center justify-center rounded border px-0.5 text-[9px] font-bold tabular-nums leading-none shadow-inner sm:h-5 sm:min-w-[1.2rem] sm:text-[9px]";
  if (spin.color === "red") {
    return cn(base, highlight ? "border-white" : "border-red-500/40", "bg-red-600 text-white");
  }
  if (spin.color === "black") {
    return cn(base, highlight ? "border-white" : "border-slate-700", "bg-slate-950 text-slate-100");
  }
  return cn(base, highlight ? "border-white" : "border-slate-700", "bg-slate-800 text-white");
}

export function Dga24dSpinLobbyCard() {
  const [rows, setRows] = useState<Dga24dSpinStored[]>(() =>
    typeof window !== "undefined" ? readDga24dSpinHistory() : [],
  );

  useEffect(() => {
    const sync = () => setRows(readDga24dSpinHistory());
    sync();
    window.addEventListener(DGA_24D_SPIN_HISTORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DGA_24D_SPIN_HISTORY_CHANGED_EVENT, sync);
  }, []);

  const display = rows.slice(0, DISPLAY_LEN);

  return (
    <article
      className={cn(
        "flex h-full min-h-0 flex-col overflow-visible rounded-2xl border bg-[#0d1524] shadow-xl",
        "border-slate-800/80",
      )}
    >
      {/* Barra superior alinhada ao `LobbyCard` (grelha 3 colunas, altura compacta). */}
      <div className="relative z-20 grid min-h-[2.25rem] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b border-transparent bg-transparent px-1.5 py-1 sm:min-h-[2.5rem] sm:gap-x-1.5 sm:px-2 sm:py-1.5">
        <div className="flex min-w-0 items-center justify-start" aria-hidden>
          <span className="inline-flex h-5 w-5 shrink-0" />
        </div>
        <div className="flex min-w-0 max-w-full flex-col items-center justify-center px-1 text-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[8px]">Pragmatic · DGA</p>
          <p className="mx-auto mt-0.5 max-w-[10rem] truncate text-[11px] font-extrabold leading-tight tracking-tight text-white sm:max-w-none sm:text-xs">
            24D Spin
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end">
          <span
            className="inline-flex shrink-0 items-center rounded-md border border-slate-600/90 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-200 shadow-md backdrop-blur-sm sm:text-[8px]"
            title={`TableKey DGA ${DGA_24D_SPIN_DEFAULT_TABLE_KEY}`}
          >
            Mesa {DGA_24D_SPIN_DEFAULT_TABLE_KEY}
          </span>
        </div>
      </div>

      {/* Igual ao bloco de imagem / histórico do `LobbyCard` (aspect 16/10 + faixa inferior). */}
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${DGA_24D_LOBBY_BG})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.42]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 40%, rgba(0,0,0,0.9) 100%), radial-gradient(ellipse 90% 55% at 50% 35%, rgba(0,0,0,0.25), transparent 52%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-nowrap justify-center gap-0.5 overflow-x-auto bg-gradient-to-t from-black via-black/75 to-transparent px-1 pb-1.5 pt-5 sm:gap-0.5 sm:px-1.5 sm:pb-2 sm:pt-6">
          {display.length === 0 ? (
            <span className="text-[9px] font-medium leading-tight text-slate-500">Aguardando giros…</span>
          ) : (
            display.map((spin, i) => (
              <span key={`${spin.gameId}-${i}`} className={cellClass(spin, i === 0)}>
                {spin.number}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Rodapé alinhado ao `LobbyCard`. */}
      <div className="flex shrink-0 items-start justify-between gap-1.5 border-t border-slate-800/90 px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 truncate text-[11px] font-bold leading-tight tracking-tight text-white sm:text-xs">24D Spin</h2>
          <p className="mt-0.5 truncate text-[8px] leading-tight text-slate-500 sm:text-[9px]">
            Números 1–24 ao vivo (WebSocket DGA) · mesma conta que as roletas
          </p>
        </div>
        <span className="shrink-0 self-center text-xs text-slate-600 sm:text-sm" aria-hidden>
          ♡
        </span>
      </div>
    </article>
  );
}
