import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartThemeColors } from "@/hooks/useChartTheme";
import {
  automationCandlestickYDomain,
  chartPointsToCandlesticks,
  formatAutomationChartYTick,
  type AutomationCandlestickPoint,
  type AutomationSimChartPoint,
} from "@/lib/back-office/rouletteAutomationSim";

type CandlestickLayerProps = {
  xAxisMap?: Record<string, { scale?: (v: string) => number; bandwidth?: () => number }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number }>;
  offset?: { left?: number; top?: number };
  candles?: AutomationCandlestickPoint[];
  bullColor?: string;
  bearColor?: string;
};

function CandlestickLayer({
  xAxisMap,
  yAxisMap,
  offset,
  candles = [],
  bullColor = "#22c55e",
  bearColor = "#ef4444",
}: CandlestickLayerProps) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined;
  const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : undefined;
  const xScale = xAxis?.scale;
  const yScale = yAxis?.scale;
  const bandwidth = xAxis?.bandwidth?.() ?? 24;

  if (!xScale || !yScale || candles.length === 0) return null;

  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;

  return (
    <g className="automation-candlesticks">
      {candles.map((candle) => {
        const xBand = xScale(candle.label);
        if (xBand == null || !Number.isFinite(xBand)) return null;

        const centerX = left + xBand + bandwidth / 2;
        const bodyWidth = Math.max(bandwidth * 0.55, 6);
        const bullish = candle.close >= candle.open;
        const color = bullish ? bullColor : bearColor;

        const highY = top + yScale(candle.high);
        const lowY = top + yScale(candle.low);
        const openY = top + yScale(candle.open);
        const closeY = top + yScale(candle.close);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

        return (
          <g key={`${candle.ts}-${candle.label}`}>
            <line
              x1={centerX}
              x2={centerX}
              y1={highY}
              y2={lowY}
              stroke={color}
              strokeWidth={1.5}
            />
            <rect
              x={centerX - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyHeight}
              fill={color}
              rx={1}
            />
          </g>
        );
      })}
    </g>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: AutomationCandlestickPoint }>;
  chart: ChartThemeColors;
  labels: {
    open: string;
    high: string;
    low: string;
    close: string;
  };
  formatMoney: (value: number) => string;
};

function CandlestickTooltip({ active, payload, chart, labels, formatMoney }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const items = [
    { label: labels.open, value: row.open },
    { label: labels.high, value: row.high },
    { label: labels.low, value: row.low },
    { label: labels.close, value: row.close },
  ];

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: chart.tooltipBackground,
        borderColor: chart.tooltipBorder,
        color: chart.tooltipText,
      }}
    >
      <p className="mb-1.5 font-semibold" style={{ color: chart.textColor }}>
        {row.label}
      </p>
      <dl className="space-y-0.5 tabular-nums">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-4">
            <dt style={{ color: chart.textColor }}>{item.label}</dt>
            <dd className="font-medium">{formatMoney(item.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type Props = {
  chartData: AutomationSimChartPoint[];
  chart: ChartThemeColors;
  formatMoney: (value: number) => string;
  emptyLabel: string;
  tooltipLabels: {
    open: string;
    high: string;
    low: string;
    close: string;
  };
};

export function AutomationCandlestickChart({
  chartData,
  chart,
  formatMoney,
  emptyLabel,
  tooltipLabels,
}: Props) {
  const candles = useMemo(() => chartPointsToCandlesticks(chartData), [chartData]);
  const yDomain = useMemo(() => automationCandlestickYDomain(candles), [candles]);
  const bullColor = chart.accentStroke;
  const bearColor = "#ef4444";

  if (candles.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-text-secondary">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={candles} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={chart.gridColor} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: chart.textColor, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={yDomain}
          tick={{ fill: chart.textColor, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => formatAutomationChartYTick(v, yDomain)}
        />
        <Tooltip
          cursor={{ stroke: chart.gridColor, strokeWidth: 1 }}
          content={
            <CandlestickTooltip
              chart={chart}
              labels={tooltipLabels}
              formatMoney={formatMoney}
            />
          }
        />
        <Customized
          component={(props: CandlestickLayerProps) => (
            <CandlestickLayer
              {...props}
              candles={candles}
              bullColor={bullColor}
              bearColor={bearColor}
            />
          )}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
