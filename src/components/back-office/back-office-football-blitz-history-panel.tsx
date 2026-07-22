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
  footballBlitzCardLabel,
} from "@/lib/pragmatic/footballBlitzEcoStrategy";
import { cn } from "@/lib/utils";

const COLOR_HISTORY_LIMIT = 48;
/** Uma linha = 8 últimas rodadas (casa em cima, visitante em baixo). */
const CARD_HISTORY_LIMIT = 8;
const SHOE_DECKS = 8;
const SHOE_TOTAL = SHOE_DECKS * 52;

type SideTone = {
  chip: string;
  soft: string;
  bar: string;
  text: string;
  label: string;
  short: string;
  /** Borda luminosa da carta desse lado no histórico de cartas. */
  cardGlow: string;
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
          cardGlow: "border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.55)]",
        }
      : {
          chip: "bg-rose-600 text-white border-rose-400/40",
          soft: "bg-rose-600/90 text-white",
          bar: "bg-rose-500",
          text: "text-rose-300",
          label: "Vermelho",
          short: "V",
          cardGlow: "border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.55)]",
        };
  return {
    home: {
      chip: "bg-amber-500 text-black border-amber-300/50",
      soft: "bg-amber-500 text-black",
      bar: "bg-amber-400",
      text: "text-amber-300",
      label: "Amarelo",
      short: "C",
      cardGlow: "border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]",
    },
    away,
    draw: {
      chip: "bg-emerald-600 text-white border-emerald-400/40",
      soft: "bg-emerald-700/90 text-emerald-50",
      bar: "bg-emerald-500",
      text: "text-emerald-300",
      label: "Empate",
      short: "E",
      cardGlow: "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]",
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

function buildCardStats(history: readonly FootballBlitzRoundStored[]) {
  const ranks = new Map<number, number>();
  let seen = 0;
  for (const round of history) {
    const exp = expandFootballBlitzRound(round);
    if (!exp) continue;
    for (const score of [exp.home.score, exp.away.score]) {
      ranks.set(score, (ranks.get(score) ?? 0) + 1);
      seen += 1;
    }
  }
  const top = [...ranks.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 6)
    .map(([score, count]) => ({
      score,
      label: footballBlitzCardLabel(score),
      count,
      pct: seen > 0 ? Math.round((count / seen) * 100) : 0,
    }));
  return { seen, unique: ranks.size, top };
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

/** Carta só com valor — a DGA Football Blitz não envia naipe. */
function MiniPlayingCard({
  label,
  score,
  side,
  glowClass,
  highlight,
}: {
  label: string;
  score: number;
  side: "home" | "away";
  glowClass: string;
  highlight?: boolean;
}) {
  const isAce = score === 1;
  return (
    <div
      className={cn(
        "relative flex h-[4.25rem] w-[3.05rem] shrink-0 flex-col items-center justify-between rounded-md border-2 bg-gradient-to-b from-white to-slate-100 px-1 py-1.5 shadow-md",
        glowClass,
        highlight && "ring-2 ring-amber-300 ring-offset-1 ring-offset-[#0d1524]",
      )}
      title={`${label} · ${side === "home" ? "Casa" : "Visitante"}`}
    >
      <span className="self-start text-[13px] font-black tabular-nums leading-none text-slate-900">
        {label}
      </span>
      <span className="text-2xl font-black tabular-nums leading-none text-slate-900">{label}</span>
      <span className="self-end rotate-180 text-[13px] font-black tabular-nums leading-none text-slate-900">
        {label}
      </span>
      {isAce ? (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[9px] font-black text-black shadow">
          A
        </span>
      ) : null}
    </div>
  );
}

/** Duas filas (casa / visitante) — visual do histórico de cartas. */
function CardHistoryPanel({
  history,
  tones,
  cardStats,
}: {
  history: readonly FootballBlitzRoundStored[];
  tones: Record<FootballBlitzWinner, SideTone>;
  cardStats: ReturnType<typeof buildCardStats>;
}) {
  const rows = history.slice(0, CARD_HISTORY_LIMIT);
  const remaining = Math.max(0, SHOE_TOTAL - cardStats.seen);

  return (
    <section className="rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Histórico de cartas
        </p>
        <span className="rounded-full border border-slate-700 bg-[#081221] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-300">
          {cardStats.seen}/{SHOE_TOTAL} cartas
          {remaining > 0 ? ` · ${remaining} rest.` : ""}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Sem cartas ainda.</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full flex-col gap-2">
            <div className="flex gap-1.5">
              {rows.map((round, i) => {
                const exp = expandFootballBlitzRound(round);
                const label = exp?.home.label ?? "?";
                const score = exp?.home.score ?? 0;
                return (
                  <MiniPlayingCard
                    key={`${round.gameId}-home-${i}`}
                    label={label}
                    score={score}
                    side="home"
                    glowClass={tones.home.cardGlow}
                    highlight={i === 0}
                  />
                );
              })}
            </div>
            <div className="flex gap-1.5">
              {rows.map((round, i) => {
                const exp = expandFootballBlitzRound(round);
                const label = exp?.away.label ?? "?";
                const score = exp?.away.score ?? 0;
                return (
                  <MiniPlayingCard
                    key={`${round.gameId}-away-${i}`}
                    label={label}
                    score={score}
                    side="away"
                    glowClass={tones.away.cardGlow}
                    highlight={i === 0}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
      {cardStats.top.length > 0 ? (
        <div className="mt-4 border-t border-slate-800/80 pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Cartas mais frequentes
          </p>
          <div className="flex flex-wrap gap-2">
            {cardStats.top.map((row) => (
              <span
                key={row.score}
                className="rounded-lg border border-slate-700 bg-[#081221] px-2.5 py-1.5 text-xs text-slate-300"
              >
                <span className="font-bold text-slate-100">{row.label}</span>
                <span className="text-slate-500"> · </span>
                <span className="tabular-nums">
                  {row.count} ({row.pct}%)
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TableDashboard({ config }: { config: FootballBlitzTableConfig }) {
  const history = useFootballBlitzTableHistory(config.tableKey);
  const tones = useMemo(() => sideTones(config.variant), [config.variant]);
  const colorStats = useMemo(() => buildColorStats(history), [history]);
  const cardStats = useMemo(() => buildCardStats(history), [history]);

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
      <CardHistoryPanel history={history} tones={tones} cardStats={cardStats} />
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
