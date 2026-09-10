import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "../../../../components/charts/useChartTheme";
import { formatPeso } from "../../../../utils/currency";

/**
 * Billed against collected, by month.
 *
 * ── Why two series and not one ──────────────────────────────────────────────
 *
 * They answer different questions and they legitimately diverge. Billed is
 * dated by the period an invoice covers; collected by when the money actually
 * arrived. A September invoice paid in October appears in September's billed
 * bar and October's collected bar, and that gap *is* the information — it is
 * the collection lag, and watching it widen is how an ISP notices trouble a
 * month before the aging report does.
 *
 * Two series, so unlike the shared single-series charts this one carries a
 * legend.
 */
const BilledVsCollected = ({ data = [] }) => {
  const t = useChartTheme();

  const rows = data.map((d) => ({
    period: d.period,
    billed: Number(d.billed) || 0,
    collected: Number(d.collected) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: -6 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />

        <XAxis
          dataKey="period"
          tickFormatter={(d) => dayjs(d).format("MMM")}
          tick={{ fontSize: 11, fill: t.axis }}
          tickLine={false}
          axisLine={{ stroke: t.grid }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: t.axis }}
          tickLine={false}
          axisLine={false}
          width={64}
          // Thousands, so a six-figure month does not eat the plot area.
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
        />

        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.35 }}
          contentStyle={{
            background: t.surface,
            border: `1px solid ${t.line}`,
            borderRadius: 10,
            fontSize: 12.5,
          }}
          labelStyle={{ color: t.text, fontWeight: 600, marginBottom: 4 }}
          labelFormatter={(d) => dayjs(d).format("MMMM YYYY")}
          formatter={(value, name) => [formatPeso(value), name === "billed" ? "Billed" : "Collected"]}
        />

        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              {value === "billed" ? "Billed" : "Collected"}
            </span>
          )}
        />

        {/* Billed is the muted bar and collected the accent: what actually
            arrived is the number worth looking at. */}
        <Bar dataKey="billed" fill={t.grid} radius={[4, 4, 0, 0]} isAnimationActive={t.animate} />
        <Bar
          dataKey="collected"
          fill={t.series}
          radius={[4, 4, 0, 0]}
          isAnimationActive={t.animate}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BilledVsCollected;
