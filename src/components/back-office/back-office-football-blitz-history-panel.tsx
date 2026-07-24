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
  expandFootballBlitzRound,
  findFootballBlitzEncounterCoincidences,
  type FootballBlitzEncounterNeighbor,
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

function NeighborChip({
  neighbor,
  tones,
  emphasize,
}: {
  neighbor: FootballBlitzEncounterNeighbor | null;
  tones: Record<FootballBlitzWinner, SideTone>;
  emphasize?: boolean;
}) {
  if (!neighbor) {
    return (
      <span className="inline-flex min-h-[3rem] min-w-[4.5rem] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-[#081221] px-2 text-[11px] text-slate-600">
        —
      </span>
    );
  }
  const tone = tones[neighbor.winner] ?? tones.draw;
  return (
    <span
      className={cn(
        "inline-flex min-h-[3rem] min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-xl border px-2 text-center",
        tone.chip,
        emphasize && "ring-2 ring-amber-300/90 ring-offset-1 ring-offset-[#0d1524]",
      )}
      title={`${tone.label} · ${neighbor.pairLabel}`}
    >
      <span className="text-[10px] font-bold uppercase opacity-80">{tone.short}</span>
      <span className="text-sm font-black leading-tight">{neighbor.pairLabel}</span>
    </span>
  );
}

function CoincidenceColumn({
  title,
  hint,
  coincidence,
  tones,
}: {
  title: string;
  hint: string;
  coincidence: {
    match: FootballBlitzEncounterNeighbor;
    left: FootballBlitzEncounterNeighbor | null;
    right: FootballBlitzEncounterNeighbor | null;
  } | null;
  tones: Record<FootballBlitzWinner, SideTone>;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-[#081221] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      {!coincidence ? (
        <p className="mt-4 text-sm text-slate-500">Sem coincidência nesta posição.</p>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 sm:gap-2">
          <div className="min-w-0 flex-1 text-center">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Esquerda
            </p>
            <NeighborChip neighbor={coincidence.left} tones={tones} />
          </div>
          <span className="shrink-0 text-slate-600">←</span>
          <div className="min-w-0 flex-1 text-center">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-amber-300/90">
              Match
            </p>
            <NeighborChip neighbor={coincidence.match} tones={tones} emphasize />
          </div>
          <span className="shrink-0 text-slate-600">→</span>
          <div className="min-w-0 flex-1 text-center">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Direita
            </p>
            <NeighborChip neighbor={coincidence.right} tones={tones} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Duas últimas coincidências do encontro actual (cartas + cor) com vizinhos. */
function EncounterCoincidencePanel({
  history,
  tones,
}: {
  history: readonly FootballBlitzRoundStored[];
  tones: Record<FootballBlitzWinner, SideTone>;
}) {
  const analysis = useMemo(
    () => findFootballBlitzEncounterCoincidences(history, { limit: 2 }),
    [history],
  );
  const triggerTone = analysis.trigger ? tones[analysis.trigger.winner] : null;

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Coincidências do encontro
        </p>
        <span className="rounded-full border border-slate-700 bg-[#081221] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
          {analysis.totalMatches} no histórico
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Últimas duas ocorrências do mesmo encontro (cartas + cor), com vizinhos à esquerda e à
        direita. Sem alerta estatístico.
      </p>

      {analysis.trigger && triggerTone ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700/80 bg-[#081221] px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Encontro actual
          </span>
          <span
            className={cn(
              "rounded-lg border px-2.5 py-1 text-sm font-black",
              triggerTone.chip,
            )}
          >
            {analysis.trigger.pairLabel} · {triggerTone.label}
          </span>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500">À espera de um encontro com cartas.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CoincidenceColumn
          title="Coincidência 1"
          hint="Mais recente no histórico"
          coincidence={analysis.coincidences[0] ?? null}
          tones={tones}
        />
        <CoincidenceColumn
          title="Coincidência 2"
          hint="Segunda mais recente"
          coincidence={analysis.coincidences[1] ?? null}
          tones={tones}
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
      <EncounterCoincidencePanel history={history} tones={tones} />
    </div>
  );
}

/** Painel Automação → Football Blitz: histórico de cor + cartas com estatísticas (sem stream). */
export function BackOfficeFootballBlitzHistoryPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Visor ao vivo das mesas DGA — histórico de cor e coincidências do encontro. Sem área de
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
