import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { LiveMultiTableNumeracaoStrip } from "@/components/live-multi-table-numeracao-strip";
import { SinglestakeLogo } from "@/components/singlestake-logo";
import { useRouletteLiveApi } from "@/lib/roulette/rouletteLiveApiContext";

const base =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-transparent px-3 text-sm font-semibold text-slate-400 transition hover:text-slate-100";
const active = "border-emerald-400/60 bg-emerald-500/15 text-emerald-200";

type RouletteAppTabsProps = {
  children?: ReactNode;
};

export function RouletteAppTabs({ children }: RouletteAppTabsProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onRua = pathname === "/ruas";
  const onRua9 = pathname === "/ruas-10pct";
  const onRua25 = pathname === "/ruas-25pct";
  const onNums28 = pathname === "/numeros-28pct";
  const { liveApiEnabled, toggleLiveApi } = useRouletteLiveApi();

  /** Números 2,8% / Ruas 9% / Ruas 25%: barra mínima (só voltar ao lobby). */
  if (
    onRua9 ||
    onRua25 ||
    onNums28 ||
    pathname === "/um-fator" ||
    pathname === "/dois-fatores" ||
    pathname === "/sala-rotativa" ||
    pathname === "/sala-rotativa-um-fator" ||
    pathname === "/super-trunfo" ||
    pathname === "/football-blitz"
  ) {
    return (
      <nav
        className="mb-6 flex w-full flex-col gap-2 rounded-2xl border border-cyan-950/30 bg-[#060a14]/95 p-2 sm:p-3"
        aria-label="Navegacao"
      >
        <Link
          to="/"
          className={`${base} inline-flex w-fit border-cyan-500/45 bg-cyan-500/10 px-4 text-cyan-100 hover:text-white`}
        >
          ← Voltar ao lobby
        </Link>
      </nav>
    );
  }

  return (
    <nav
      className="mb-6 flex w-full flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2 sm:p-2"
      aria-label="Navegacao principal"
    >
      <LiveMultiTableNumeracaoStrip />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-2.5">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            className={`${base} !h-auto min-h-0 items-center px-2 py-1.5 ${pathname === "/" ? active : ""}`}
          >
            <SinglestakeLogo className="h-14 w-[min(400px,90vw)] sm:h-16" />
          </Link>
          <Link to="/ruas" className={`${base} ${onRua ? active : ""}`}>
            Ruas 20%
          </Link>
          <Link to="/numeros-28pct" className={`${base} ${onNums28 ? active : ""}`}>
            Números 2,8%
          </Link>
          <Link to="/ruas-10pct" className={`${base} ${onRua9 ? active : ""}`}>
            Ruas 9%
          </Link>
          <Link to="/ruas-25pct" className={`${base} ${onRua25 ? active : ""}`}>
            Ruas 25%
          </Link>
        </div>
        {children ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
        ) : null}
        <button
          type="button"
          onClick={toggleLiveApi}
          className={`inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
            liveApiEnabled
              ? "border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
              : "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
          }`}
          aria-pressed={liveApiEnabled}
          aria-label="API"
        >
          {liveApiEnabled ? "Desligar API" : "Ligar API"}
        </button>
      </div>
    </nav>
  );
}
