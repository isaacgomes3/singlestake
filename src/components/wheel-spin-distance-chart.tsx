import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import {
  missingWheelSpinDistancesInSlice,
  type WheelSpinDistanceDatum,
} from "@/lib/roulette/cylinderIndication";

/** Transições mais recentes usadas no gráfico de linha. */
const CHART_LAST_TRANSICOES = 15;

type Props = {
  data: WheelSpinDistanceDatum[];
};

export type WheelSpinDistanceLinePoint = WheelSpinDistanceDatum & {
  /** 1 … CHART_LAST_TRANSICOES no eixo X (últimas transições). */
  rodadaNoGrafico: number;
};

export function WheelSpinDistanceChart({ data }: Props) {
  const slice = useMemo(
    () =>
      data.length <= CHART_LAST_TRANSICOES ? data : data.slice(-CHART_LAST_TRANSICOES),
    [data],
  );

  const timelineSeries = useMemo(
    (): WheelSpinDistanceLinePoint[] =>
      slice.map((row, i) => ({ ...row, rodadaNoGrafico: i + 1 })),
    [slice],
  );

  const missingDistances = useMemo(() => missingWheelSpinDistancesInSlice(slice), [slice]);

  const maxD = timelineSeries.reduce((m, r) => Math.max(m, r.distance), 0);
  const yMaxLine = Math.max(6, maxD + 1);

  const totalTransitions = slice.length;

  return (
    <Card className="border-slate-800 bg-slate-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-200">
        <span>Distância no cilindro (anterior no tempo → seguinte)</span>
        <span className="font-mono text-xs text-slate-400" title="Menor caminho em casas no anel físico europeu">
          últimas {CHART_LAST_TRANSICOES} trans.
        </span>
      </div>
      {totalTransitions > 0 ? (
        <div className="mb-3 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <span className="font-semibold text-slate-200">
            Distâncias sem ocorrência nestas {slice.length} trans. (0–18):
          </span>{" "}
          <span
            className="font-mono text-emerald-300"
            title="Valores de distância no anel que não apareceram em nenhuma das transições da janela"
          >
            {missingDistances.join(", ")}
          </span>
        </div>
      ) : null}
      {totalTransitions === 0 ? (
        <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-500">
          São precisos pelo menos 2 giros no espelho.
        </div>
      ) : (
        <div className="h-52 w-full min-w-0 rounded-lg bg-[#0a0e17] p-1 ring-1 ring-slate-800/80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineSeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="rodadaNoGrafico"
                tick={{ fill: "#94a3b8", fontSize: 9 }}
                tickLine={{ stroke: "#334155" }}
                axisLine={{ stroke: "#334155" }}
                label={{
                  value: "Transição (1 = mais antiga na janela)",
                  position: "insideBottom",
                  offset: -2,
                  fill: "#64748b",
                  fontSize: 10,
                }}
              />
              <YAxis
                domain={[0, yMaxLine]}
                allowDecimals={false}
                width={28}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={{ stroke: "#334155" }}
                axisLine={{ stroke: "#334155" }}
                label={{
                  value: "Casas no anel",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#64748b",
                  fontSize: 10,
                  dx: -4,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as WheelSpinDistanceLinePoint;
                  return (
                    <div className="rounded-lg border border-slate-600 bg-slate-950/95 px-2.5 py-2 text-xs text-slate-100 shadow-lg">
                      <div className="font-mono text-slate-300">
                        {d.from} <span className="text-slate-500">→</span> {d.to}
                      </div>
                      <div className="mt-1 font-semibold text-emerald-300">
                        {d.distance} casas no anel (mínimo no cilindro)
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                        Janela {d.rodadaNoGrafico}/{timelineSeries.length} · série #{d.jogada}
                      </div>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={1} stroke="#64748b" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="distance"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 2, fill: "#6ee7b7" }}
                activeDot={{ r: 4 }}
                name="Distância"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
