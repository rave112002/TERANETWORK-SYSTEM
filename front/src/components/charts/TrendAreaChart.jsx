import { useId } from "react";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { useChartTheme } from "./useChartTheme";

/**
 * Single-series change-over-time chart.
 *
 * Single series ⇒ no legend (the card title names it). 2px line, soft fill,
 * recessive horizontal-only grid, crosshair + tooltip on hover, and an ≥8px
 * active dot. Integer-only Y ticks — these are counts.
 *
 * @param {{ data: {date: string, count: number}[], valueLabel?: string }} props
 */
const TrendAreaChart = ({ data = [], valueLabel = "" }) => {
  const t = useChartTheme();
  const gradientId = useId();

  // Counts are integers — avoid recharts inventing 0.5 ticks on small ranges
  const max = Math.max(1, ...data.map((d) => d.count || 0));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : undefined;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.series} stopOpacity={0.22} />
            <stop offset="100%" stopColor={t.series} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Recessive grid: horizontal only, hairline */}
        <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={(d) => dayjs(d).format("MMM D")}
          tick={{ fontSize: 11, fill: t.axis }}
          tickLine={false}
          axisLine={{ stroke: t.grid }}
          minTickGap={18}
        />
        <YAxis
          allowDecimals={false}
          ticks={ticks}
          domain={[0, ticks ? max : "auto"]}
          tick={{ fontSize: 11, fill: t.axis }}
          tickLine={false}
          axisLine={false}
          width={44}
        />

        <Tooltip
          cursor={{ stroke: t.axis, strokeWidth: 1 }}
          content={
            <ChartTooltip
              seriesColor={t.series}
              valueLabel={valueLabel}
              labelFormatter={(d) => dayjs(d).format("ddd, MMM D, YYYY")}
            />
          }
        />

        <Area
          type="monotone"
          dataKey="count"
          stroke={t.series}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={t.animate}
          activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface, fill: t.series }}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default TrendAreaChart;
