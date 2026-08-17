import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import CategoryBarChart from "@/components/charts/CategoryBarChart";
import ChartCard from "@/components/charts/ChartCard";
import TrendAreaChart from "@/components/charts/TrendAreaChart";
import { Demo, Section } from "./Showcase";

// Fixed sample series so the preview renders the same shape every visit.
const TREND = [12, 18, 15, 24, 21, 30, 27, 34, 31, 42, 38, 46, 44, 52].map(
  (count, i) => ({
    date: dayjs("2026-08-01").add(i, "day").format("YYYY-MM-DD"),
    count,
  }),
);

const CATEGORIES = [
  { label: "Admin", value: 24 },
  { label: "Manager", value: 18 },
  { label: "Staff", value: 41 },
  { label: "Auditor", value: 9 },
  { label: "Guest", value: 5 },
];

const ChartsSection = () => (
  <Section
    id="charts"
    title="Charts"
    description="Recharts wrapped in the flat ChartCard. One series, one hue, no legend — the card title names the measure."
  >
    <Demo wide name="ChartCard + TrendAreaChart" source="@/components/charts/TrendAreaChart">
      <ChartCard
        title="New users"
        subtitle="Last 14 days"
        action={
          <Button variant="outline" size="sm">
            Export
          </Button>
        }
      >
        <TrendAreaChart data={TREND} valueLabel="users" />
      </ChartCard>
    </Demo>

    <Demo wide name="ChartCard + CategoryBarChart" source="@/components/charts/CategoryBarChart">
      <ChartCard title="Users per role" subtitle="Current company">
        <CategoryBarChart data={CATEGORIES} valueLabel="users" />
      </ChartCard>
    </Demo>
  </Section>
);

export default ChartsSection;
