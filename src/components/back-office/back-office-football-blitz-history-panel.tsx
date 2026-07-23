import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FOOTBALL_BLITZ_SUPER_TRUNFO,
  FOOTBALL_BLITZ_TOP_CARD,
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
  analyzeFootballBlitzSidePatternByCard,
  expandFootballBlitzRound,
  findFootballBlitzSidePatternAlert,
  footballBlitzCardLabel,
  scoreFootballBlitzSidePatternAlerts,
} from "@/lib/pragmatic/footballBlitzEcoStrategy";
import { cn } from "@/lib/utils";

const COLOR_HISTORY_LIMIT = 48;

type SideTone = {
  chip: string;
  soft: string;
  bar: string;
  text: string;
  label: string;
  short: string;
};

function sideTones(variant: FootballBlitzTableVariant): Record<FootballBlitzWinner, SideTone> {
  const away =
    variant === "top-card"
      ? {
          chip: "bg-blue-600 text-white border-blue-400/40",
          soft: "bg-blue-600/90 text-white",
          bar: "bg-blue-500",
          text: "text-blue-300",
          label: "Azul",
          short: "V",
        }
      : {
          chip: "bg-rose-600 text-white border-rose-400/40",
          soft: "bg-rose-600/90 text-white",
          bar: "bg-rose-500",
          text: "text-rose-300",
          label: "Vermelho",
          short: "V",
        };
  return {
    home: {
      chip: "bg-amber-500 text-black border-amber-300/50",
      soft: "bg-amber-500 text-black",
      bar: "bg-amber-400",
      text: "text-amber-300",
      label: "Amarelo",
      short: "C",
    },
    away,
    draw: {
      chip: "bg-emerald-600 text-white border-emerald-400/40",
      soft: "bg-emerald-700/90 text-emerald-50",
      bar: "bg-emerald-500",
      text: "text-emerald-300",
      label: "Empate",
      short: "E",
    },
  };
}

function useFootballBlitzTableHistory(tableKey: number) {
  const [history, setHistory] = useState<FootballBlitzRoundStored[]>(() =>
    typeof window !== "undefined" ? readFootballBlitzHistory(tableKey) : [],
  );

  useEffect(() => {
    const sync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tableKey?: number }>).detail;
      if (detail?.tableKey != null && detail.tableKey !== tableKey) return;
      setHistory(readFootballBlitzHistory(tableKey));
    };
    sync(new Event("init"));
    window.addEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
  }, [tableKey]);

  return history;
}

function roundHasAce(round: FootballBlitzRoundStored): boolean {
  const exp = expandFootballBlitzRound(round);
  if (!exp) return Number(round.winningNumber) === 1;
  return exp.home.score === 1 || exp.away.score === 1;
}

function maxSideStreak(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  side: "home" | "away",
): number {
  let max = 0;
  let cur = 0;
  // chronological for streak of consecutive same winner
  for (let i = historyNewestFirst.length - 1; i >= 0; i -= 1) {
    const w = historyNewestFirst[i]?.winner;
    if (w === side) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}

function buildColorStats(history: readonly FootballBlitzRoundStored[]) {
  let home = 0;
  let away = 0;
  let draw = 0;
  let aces = 0;
  for (const round of history) {
    if (round.winner === "home") home += 1;
    else if (round.winner === "away") away += 1;
    else if (round.winner === "draw") draw += 1;
    if (roundHasAce(round)) aces += 1;
  }
  const total = home + away + draw;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    home,
    away,
    draw,
    aces,
    total,
    homePct: pct(home),
    awayPct: pct(away),
    drawPct: pct(draw),
    maxHomeStreak: maxSideStreak(history, "home"),
    maxAwayStreak: maxSideStreak(history, "away"),
  };
}

function StatTile({
  title,
  value,
  pct,
  className,
  icon,
}: {
  title: string;
  value: number | string;
  pct?: number;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-black/20 px-3 py-3 shadow-inner", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-90">{title}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums leading-none">{value}</p>
      {pct != null ? (
        <p className="mt-1 text-xs font-semibold tabular-nums opacity-90">{pct}%</p>
      ) : null}
    </div>
  );
}

function DistributionBars({
  tones,
  homePct,
  awayPct,
  drawPct,
}: {
  tones: Record<FootballBlitzWinner, SideTone>;
  homePct: number;
  awayPct: number;
  drawPct: number;
}) {
  const rows: Array<{ key: FootballBlitzWinner; pct: number }> = [
    { key: "home", pct: homePct },
    { key: "away", pct: awayPct },
    { key: "draw", pct: drawPct },
  ];
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#080d18]/80 p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Distribuição
      </p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className={cn("w-16 text-xs font-semibold", tones[row.key].text)}>
              {tones[row.key].label}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-900">
              <div
                className={cn("h-full rounded-full transition-all", tones[row.key].bar)}
                style={{ width: `${Math.max(row.pct, row.pct > 0 ? 2 : 0)}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-300">
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Chip cor+par (ex. 4/5) — visual do histórico de cor. */
function ColorHistoryPanel({
  history,
  tones,
  stats,
}: {
  history: readonly FootballBlitzRoundStored[];
  tones: Record<FootballBlitzWinner, SideTone>;
  stats: ReturnType<typeof buildColorStats>;
}) {
  const rows = history.slice(0, COLOR_HISTORY_LIMIT);
  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Histórico de cor
        </p>
        <p className="text-[11px] text-slate-400">
          Máxima{" "}
          <span className={cn("font-bold", tones.home.text)}>C {stats.maxHomeStreak}</span>
          {" · "}
          <span className={cn("font-bold", tones.away.text)}>V {stats.maxAwayStreak}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sem rondas ainda.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
          {rows.map((round, i) => {
            const exp = expandFootballBlitzRound(round);
            const tone = tones[round.winner] ?? tones.draw;
            const label = exp
              ? `${exp.home.label}/${exp.away.label}`
              : footballBlitzCardLabel(Number(round.winningNumber));
            return (
              <span
                key={`${round.gameId}-color-${i}`}
                className={cn(
                  "inline-flex min-h-[2.6rem] items-center justify-center rounded-lg border px-1 text-center text-[11px] font-extrabold leading-tight sm:min-h-[2.85rem] sm:text-xs",
                  tone.chip,
                  i === 0 && "ring-2 ring-amber-300/80 ring-offset-1 ring-offset-[#0d1524]",
                )}
                title={`${tone.label} · ${label}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PatternStatColumn({
  title,
  hint,
  rows,
  accentClass,
  barClass,
}: {
  title: string;
  hint: string;
  rows: Array<{ card: number; label: string; hits: number; samples: number; rate: number }>;
  accentClass: string;
  barClass: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", accentClass)}>{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Sem amostra ainda.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={`${title}-${row.card}`}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#081221] px-2.5 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
                {i + 1}
              </span>
              <span className="w-8 text-center text-base font-black text-white">{row.label}</span>
              <div className="min-w-0 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={cn("h-full rounded-full", barClass)}
                    style={{ width: `${Math.max(row.rate, row.rate > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-slate-200">
                {row.rate}%
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                {row.hits}/{row.samples}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Top cartas que mantêm ou mudam o lado (casa/visitante) na ronda seguinte. */
function SidePatternStatsPanel({
  history,
  tones,
}: {
  history: readonly FootballBlitzRoundStored[];
  tones: Record<FootballBlitzWinner, SideTone>;
}) {
  const analysis = useMemo(
    () => analyzeFootballBlitzSidePatternByCard(history, { top: 6, minSamples: 1 }),
    [history],
  );
  const alert = useMemo(
    () => findFootballBlitzSidePatternAlert(history, { minSamples: 2 }),
    [history],
  );
  const alertPlacar = useMemo(
    () => scoreFootballBlitzSidePatternAlerts(history, { minSamples: 2 }),
    [history],
  );
  const indicationTone = alert ? tones[alert.indication] : null;
  const hitRate =
    alertPlacar.settled > 0
      ? Math.round((alertPlacar.wins / alertPlacar.settled) * 1000) / 10
      : null;

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Padrão de lado por carta
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-700/50 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-300">
            {alertPlacar.wins}V
          </span>
          <span className="rounded-full border border-rose-700/50 bg-rose-950/40 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-300">
            {alertPlacar.losses}D
          </span>
          <span className="rounded-full border border-slate-700 bg-[#081221] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
            {alertPlacar.settled} ind.
            {hitRate != null ? ` · ${hitRate}%` : ""}
          </span>
          <span className="rounded-full border border-slate-700 bg-[#081221] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
            {analysis.transitions} transições
          </span>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Após a carta sair: manter = mesmo lado vencedor na seguinte · mudar = lado oposto. Alerta
        quando a última ronda junta duas cartas 100% manter ou duas 100% mudar (≥2 amostras).
        Placar: cada indicação liquidada na ronda seguinte (empate = derrota).
      </p>

      {alert && indicationTone ? (
        <div
          className="mb-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/35 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                Alerta · encontro 100% {alert.mode === "maintain" ? "mantém" : "muda"}
                {alertPlacar.pending?.triggerGameId === alert.triggerGameId ? " · pendente" : ""}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span
                  className={cn(
                    "font-bold",
                    alert.mode === "maintain" ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {alert.homeLabel}
                </span>
                <span className="text-slate-500"> ({alert.homeSamples}×)</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span
                  className={cn(
                    "font-bold",
                    alert.mode === "maintain" ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {alert.awayLabel}
                </span>
                <span className="text-slate-500"> ({alert.awaySamples}×)</span>
                <span className="text-slate-400">
                  {" "}
                  · ambas {alert.mode === "maintain" ? "mantêm" : "mudam"} 100%
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {alert.mode === "maintain"
                  ? "Próxima ronda tende a repetir o lado vencedor actual"
                  : "Próxima ronda tende a inverter o lado vencedor actual"}
              </p>
            </div>
            <div
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-center shadow-lg",
                indicationTone.soft,
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
                Indica
              </p>
              <p className="text-lg font-black leading-tight">{indicationTone.label}</p>
            </div>
          </div>
        </div>
      ) : null}

      {alertPlacar.outcomes.length > 0 ? (
        <p className="mb-4 flex flex-wrap gap-1 text-[11px] font-semibold tabular-nums tracking-wide">
          {alertPlacar.outcomes.map((o, i) => (
            <span
              key={`${o}-${i}`}
              className={cn(
                "rounded px-1.5 py-0.5",
                o === "W" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
              )}
            >
              {o}
            </span>
          ))}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <PatternStatColumn
          title="Mais mudam o padrão"
          hint="Lado vencedor troca na ronda seguinte"
          rows={analysis.changeSide}
          accentClass="text-rose-300"
          barClass="bg-rose-500"
        />
        <PatternStatColumn
          title="Mais mantêm o padrão"
          hint="Mesmo lado vencedor na ronda seguinte"
          rows={analysis.maintainSide}
          accentClass="text-emerald-300"
          barClass="bg-emerald-500"
        />
      </div>
    </section>
  );
}

function TableDashboard({ config }: { config: FootballBlitzTableConfig }) {
  const history = useFootballBlitzTableHistory(config.tableKey);
  const tones = useMemo(() => sideTones(config.variant), [config.variant]);
  const colorStats = useMemo(() => buildColorStats(history), [history]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-100">{config.displayName}</h3>
          <p className="text-xs text-slate-500">
            Mesa {config.tableKey} · {colorStats.total} rondas · sem stream
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title={`Casa · ${tones.home.label}`}
          value={colorStats.home}
          pct={colorStats.homePct}
          className={tones.home.soft}
        />
        <StatTile
          title={`Visit · ${tones.away.label}`}
          value={colorStats.away}
          pct={colorStats.awayPct}
          className={tones.away.soft}
        />
        <StatTile
          title="Empate"
          value={colorStats.draw}
          pct={colorStats.drawPct}
          className={tones.draw.soft}
        />
        <StatTile
          title="Ás total"
          value={colorStats.aces}
          className="border-amber-500/40 bg-amber-400 text-black"
          icon={<Crown className="h-4 w-4 opacity-80" />}
        />
      </div>

      <DistributionBars
        tones={tones}
        homePct={colorStats.homePct}
        awayPct={colorStats.awayPct}
        drawPct={colorStats.drawPct}
      />

      <ColorHistoryPanel history={history} tones={tones} stats={colorStats} />
      <SidePatternStatsPanel history={history} tones={tones} />
    </div>
  );
}

/** Painel Automação → Football Blitz: histórico de cor + cartas com estatísticas (sem stream). */
export function BackOfficeFootballBlitzHistoryPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Visor ao vivo das mesas DGA — histórico de cor e de cartas com estatísticas. Sem área de
        stream.
      </p>
      <Tabs defaultValue="top-card" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 border border-slate-800 bg-[#0d1524] p-1">
          <TabsTrigger
            value="top-card"
            className="py-2.5 text-xs text-slate-400 data-[state=active]:bg-cyan-950/70 data-[state=active]:text-cyan-100 sm:text-sm"
          >
            Top Card · 4001
          </TabsTrigger>
          <TabsTrigger
            value="latino"
            className="py-2.5 text-xs text-slate-400 data-[state=active]:bg-cyan-950/70 data-[state=active]:text-cyan-100 sm:text-sm"
          >
            Latino · 4022
          </TabsTrigger>
        </TabsList>
        <TabsContent value="top-card" className="mt-4">
          <TableDashboard config={FOOTBALL_BLITZ_TOP_CARD} />
        </TabsContent>
        <TabsContent value="latino" className="mt-4">
          <TableDashboard config={FOOTBALL_BLITZ_SUPER_TRUNFO} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
