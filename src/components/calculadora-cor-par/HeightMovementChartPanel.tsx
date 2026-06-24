import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildHeightMovementChartData } from "@/lib/calculadoraCorPar/heightMovementChartData";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Número máximo de rodadas mostradas no gráfico (mais recentes). */
const CHART_MAX_RODADAS = 50;

type Props = {
  history: number[];
  visible: boolean;
  alertActive?: boolean;
  /** Jogadas 1-based (cronológicas) a realçar no eixo X (quebra / recuperação do gatilho). */
  markBreakJogada?: number;
  markRecoveryJogada?: number;
};

export function HeightMovementChartPanel({
  history,
  visible,
  alertActive,
  markBreakJogada,
  markRecoveryJogada,
}: Props) {
  if (!visible) return null;

  const { data, maxRunup, maxDrawdown } = (() => {
    if (history.length === 0) return { data: [], maxRunup: 0, maxDrawdown: 0 };
    const full = buildHeightMovementChartData(history);
    const data = full.length <= CHART_MAX_RODADAS ? full : full.slice(-CHART_MAX_RODADAS);
    let maxR = 0;
    let maxD = 0;
    for (const row of data) {
      maxR = Math.max(maxR, row.sequence > 0 ? row.sequence : 0);
      maxD = Math.max(maxD, row.sequence < 0 ? Math.abs(row.sequence) : 0);
    }
    return { data, maxRunup: maxR, maxDrawdown: maxD };
  })();

  const tooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { payload: (typeof data)[0] }[];
    label?: string;
  }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-xs text-slate-100 shadow-lg">
        <div>{label}</div>
        <div className="font-mono">{d.number}</div>
        <div style={{ color: d.color }}>{d.groupLabel}</div>
        <div>{d.sequence > 0 ? `+${d.sequence}` : d.sequence}</div>
      </div>
    );
  };

  const showBreakMark =
    markBreakJogada != null && data.some((r) => r.jogada === markBreakJogada);
  const showRecoveryMark =
    markRecoveryJogada != null && data.some((r) => r.jogada === markRecoveryJogada);

  return (
    <Card
      className={cn(
        "border-slate-800 bg-slate-900/80 p-4",
        alertActive && "ring-2 ring-amber-400/50",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-200">
        <span>Altura (1–18 / 19–36)</span>
        <span className="font-mono text-xs text-slate-400" title="Janela visível: últimas 50 rodadas">
          +{maxRunup} / −{maxDrawdown}
          {history.length > CHART_MAX_RODADAS ? ` · ${CHART_MAX_RODADAS} últ.` : ""}
        </span>
      </div>
      {history.length === 0 ? (
        <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-500">
          —
        </div>
      ) : (
        <div className="h-52 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="jogada" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip content={tooltip as never} />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
              {showBreakMark ? (
                <ReferenceLine
                  x={markBreakJogada}
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  label={{ value: "Quebra", fill: "#fbbf24", fontSize: 10 }}
                />
              ) : null}
              {showRecoveryMark ? (
                <ReferenceLine
                  x={markRecoveryJogada}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  label={{ value: "Recup.", fill: "#38bdf8", fontSize: 10 }}
                />
              ) : null}
              <Bar dataKey="sequence" radius={[2, 2, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke={entry.color} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
