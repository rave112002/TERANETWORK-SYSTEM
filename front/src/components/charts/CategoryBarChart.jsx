import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { useChartTheme } from "./useChartTheme";

/**
 * Single-series categorical magnitude chart.
 *
 * One measure across a fixed set of categories ⇒ one hue, no legend. 4px rounded
 * data-ends anchored to the baseline, a gap between bars, recessive horizontal
 * grid, and a per-bar hover tooltip.
 *
 * @param {{ data: {label: string, value: number}[], valueLabel?: string }} props
 */
const CategoryBarChart = ({ data = [], valueLabel = "" }) => {
  const t = useChartTheme();

  const max = Math.max(1, ...data.map((d) => d.value || 0));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : undefined;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 4, right: 12, bottom: 0, left: -18 }}
        barCategoryGap="35%"
      >
        <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: t.axis }}
          tickLine={false}
          axisLine={{ stroke: t.grid }}
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
          cursor={{ fill: t.grid, fillOpacity: 0.35 }}
          content={<ChartTooltip seriesColor={t.series} valueLabel={valueLabel} />}
        />

        {/* 4px rounded top corners; the base stays square on the baseline */}
        <Bar
          dataKey="value"
          fill={t.series}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          isAnimationActive={t.animate}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default CategoryBarChart;
