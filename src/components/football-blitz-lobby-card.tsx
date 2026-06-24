import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  FOOTBALL_BLITZ_TABLES,
  type FootballBlitzTableConfig,
  type FootballBlitzTableVariant,
} from "@/lib/pragmatic/dgaFootballBlitzConstants";
import {
  DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT,
  readFootballBlitzHistory,
  type FootballBlitzRoundStored,
  type FootballBlitzWinner,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  evaluateSuperTrunfoAlert,
  formatSuperTrunfoRoundLabel,
  formatSuperTrunfoSpreadDisplay,
  isSuperTrunfoZeroRound,
} from "@/lib/pragmatic/superTrunfoAlert";
import { useSuperTrunfoPlacar } from "@/hooks/useSuperTrunfoPlacar";
import { cn } from "@/lib/utils";

const DISPLAY_LEN = 7;

const WINNER_TITLE: Record<FootballBlitzWinner, string> = {
  home: "Mandante",
  away: "Visitante",
  draw: "Empate",
};

function cellClass(
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  highlight: boolean,
  variant: FootballBlitzTableVariant,
): string {
  const base =
    "inline-flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded border px-0.5 text-[8px] font-bold tabular-nums leading-none shadow-inner sm:h-5 sm:min-w-[1.65rem] sm:text-[9px]";
  if (isSuperTrunfoZeroRound(round)) {
    return cn(
      base,
      highlight ? "border-emerald-200" : "border-emerald-500/50",
      "bg-emerald-600 text-white",
    );
  }
  if (round.winner === "home") {
    return cn(
      base,
      highlight ? "border-amber-200" : "border-amber-400/50",
      "bg-amber-500 text-black",
    );
  }
  if (round.winner === "away") {
    if (variant === "top-card") {
      return cn(base, highlight ? "border-sky-200" : "border-blue-500/50", "bg-blue-600 text-white");
    }
    return cn(base, highlight ? "border-rose-200" : "border-rose-500/50", "bg-rose-600 text-white");
  }
  return cn(base, highlight ? "border-white" : "border-slate-500/50", "bg-slate-700 text-white");
}

function formatSpread(scoreDiff: number): string {
  return formatSuperTrunfoSpreadDisplay(scoreDiff);
}

type FootballBlitzLobbyCardProps = {
  variant: FootballBlitzTableVariant;
};

export function FootballBlitzLobbyCard({ variant }: FootballBlitzLobbyCardProps) {
  const config: FootballBlitzTableConfig = FOOTBALL_BLITZ_TABLES[variant];
  const { tableKey, displayName, lobbyBg, route } = config;

  const [rows, setRows] = useState<FootballBlitzRoundStored[]>(() =>
    typeof window !== "undefined" ? readFootballBlitzHistory(tableKey) : [],
  );

  useEffect(() => {
    const sync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tableKey?: number }>).detail;
      if (detail?.tableKey != null && detail.tableKey !== tableKey) return;
      setRows(readFootballBlitzHistory(tableKey));
    };
    sync(new Event("init"));
    window.addEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
  }, [tableKey]);

  const alertState = useMemo(() => evaluateSuperTrunfoAlert(rows, variant), [rows, variant]);
  const { wins, losses, aproveitamentoPct } = useSuperTrunfoPlacar(tableKey, rows, variant);
  const hasEntry = alertState.type === "entry";
  const display = rows.slice(0, DISPLAY_LEN);

  const article = (
    <article
      className={cn(
        "flex h-full min-h-0 flex-col overflow-visible rounded-2xl border bg-[#0d1524] shadow-xl transition hover:opacity-[0.98]",
        hasEntry
          ? "border-amber-400/70 shadow-[0_0_22px_rgba(245,158,11,0.22)]"
          : "border-slate-800/80",
      )}
    >
      <div className="relative z-20 grid min-h-[2.25rem] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-1 border-b border-transparent bg-transparent px-1.5 py-1 sm:min-h-[2.5rem] sm:gap-x-1.5 sm:px-2 sm:py-1.5">
        <div className="flex min-w-0 items-center justify-start" aria-hidden>
          <span className="inline-flex h-5 w-5 shrink-0" />
        </div>
        <div className="flex min-w-0 max-w-full flex-col items-center justify-center px-1 text-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[8px]">
            Pragmatic · DGA
          </p>
          <p className="mx-auto mt-0.5 max-w-[10rem] truncate text-[11px] font-extrabold leading-tight tracking-tight text-white sm:max-w-none sm:text-xs">
            {displayName}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end">
          {hasEntry ? (
            <span className="inline-flex shrink-0 items-center rounded-md border border-amber-300/80 bg-amber-500/20 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-amber-100 shadow-md sm:text-[8px]">
              Entrada
            </span>
          ) : (
            <span
              className="inline-flex shrink-0 items-center rounded-md border border-slate-600/90 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-wide text-slate-200 shadow-md backdrop-blur-sm sm:text-[8px]"
              title={`TableKey DGA ${tableKey}`}
            >
              Mesa {tableKey}
            </span>
          )}
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${lobbyBg})` }}
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
            <span className="text-[9px] font-medium leading-tight text-slate-500">Aguardando rondas…</span>
          ) : (
            display.map((round, i) => (
              <span
                key={`${round.gameId}-${i}`}
                className={cellClass(round, i === 0, variant)}
                title={`${WINNER_TITLE[round.winner]} · spread ${formatSpread(round.scoreDiff)} · carta vencedora ${round.winningNumber}`}
              >
                {formatSpread(round.scoreDiff)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start justify-between gap-1.5 border-t border-slate-800/90 px-2 py-1.5 sm:px-2.5 sm:py-2">
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 truncate text-[11px] font-bold leading-tight tracking-tight text-white sm:text-xs">
            {displayName}
          </h2>
          <p className="mt-0.5 truncate text-[8px] leading-tight text-slate-500 sm:text-[9px]">
            {wins + losses > 0
              ? `W ${wins} · L ${losses} · ${aproveitamentoPct.toFixed(1)}% · `
              : null}
            {hasEntry
              ? `Pos. 1/12 ${alertState.comparisonEqual ? "iguais" : "diferentes"} · base pos. 11 ${alertState.referenceFollowUpLabel} · abrir tapete`
              : rows.length > 0
                ? `Último ${formatSuperTrunfoRoundLabel(rows[0]!, variant)} · clique para tapete`
                : "Clique para abrir tapete e indicações"}
          </p>
        </div>
        <span className="shrink-0 self-center text-xs text-slate-600 sm:text-sm" aria-hidden>
          ♡
        </span>
      </div>
    </article>
  );

  return (
    <div className="relative block h-full min-h-0 rounded-2xl outline-none transition focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-[#060a14]">
      <Link
        to={route}
        className="absolute inset-0 z-[1] rounded-2xl"
        aria-label={`${displayName}: abrir tapete e indicações ao vivo.`}
      />
      <div className="relative z-[2] pointer-events-none h-full min-h-0">{article}</div>
    </div>
  );
}

export function SuperTrunfoLobbyCard() {
  return <FootballBlitzLobbyCard variant="super-trunfo" />;
}

export function FootballBlitzTopCardLobbyCard() {
  return <FootballBlitzLobbyCard variant="top-card" />;
}
