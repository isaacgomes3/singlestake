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

import { buildColorMovementChartData } from "@/lib/calculadoraCorPar/colorMovementChartData";
import { Card } from "@/components/ui/card";

/** Número máximo de rodadas mostradas no gráfico (mais recentes). */
const CHART_MAX_RODADAS = 50;

type Props = {
  history: number[];
  visible: boolean;
};

export function ColorMovementChartPanel({ history, visible }: Props) {
  if (!visible) return null;

  const { data, maxRunup, maxDrawdown } = (() => {
    if (history.length === 0) return { data: [], maxRunup: 0, maxDrawdown: 0 };
    const out = buildColorMovementChartData(history);
    const data =
      out.length <= CHART_MAX_RODADAS ? out : out.slice(-CHART_MAX_RODADAS);
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

  return (
    <Card className="border-slate-800 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-200">
        <span>Cor</span>
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
