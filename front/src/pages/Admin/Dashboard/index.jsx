import { Link } from "react-router";
import dayjs from "dayjs";
import {
  CircleAlert,
  CircleCheck,
  Router,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useDashboardData } from "./hooks";
import BilledVsCollected from "./components/BilledVsCollected";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import ChartCard from "../../../components/charts/ChartCard";
import RefreshButton from "../../../components/RefreshButton";
import Spinner from "../../../components/Spinner";
import { formatPeso } from "../../../utils/currency";

const SEVERITY = {
  error: { color: "var(--color-error)", icon: TriangleAlert },
  warning: { color: "var(--color-warning)", icon: TriangleAlert },
  info: { color: "var(--color-link)", icon: CircleAlert },
};

/**
 * The list that makes this screen worth opening.
 *
 * Empty is the healthy state and reads as one — a screen full of zeroes trains
 * people to skim past it on the morning one of them is not zero.
 */
const NeedsAttention = ({ items }) => (
  <div
    className="overflow-hidden"
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="px-4.5 py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-dark)" }}>
        Needs attention
      </span>
    </div>

    {items.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
        <CircleCheck className="w-7 h-7" style={{ color: "var(--color-success)" }} />
        <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
          Nothing needs you right now
        </p>
        <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          No stuck jobs, nobody past due, nothing waiting to be applied.
        </p>
      </div>
    ) : (
      <div>
        {items.map((item) => {
          const meta = SEVERITY[item.severity] ?? SEVERITY.info;
          const Icon = meta.icon;

          return (
            <div
              key={item.key}
              className="flex items-start gap-3 px-4.5 py-3.5"
              style={{ borderBottom: "1px solid var(--color-line-soft)" }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                strokeWidth={1.9}
                style={{ color: meta.color, marginTop: 2 }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="m-0"
                  style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-text-dark)" }}
                >
                  {item.title}
                </p>
                <p
                  className="m-0 mt-0.5"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  {item.detail}
                </p>
              </div>
              {/* Every item links to the screen where it gets fixed. A warning
                  you cannot act on from where you read it is a warning people
                  learn to ignore. */}
              <Link
                to={item.to}
                className="shrink-0 text-[12.5px] hover:underline"
                style={{ color: "var(--color-link)", marginTop: 2 }}
              >
                {item.cta}
              </Link>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const DashboardPage = () => {
  const {
    attention,
    money,
    service,
    network,
    series,
    period,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDashboardData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading the dashboard</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="large" />
      </div>
    );
  }

  const thisMonth = period ? dayjs(period.monthStart).format("MMMM YYYY") : "";

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={
          thisMonth ? `Where the business stands, ${thisMonth}.` : "Where the business stands."
        }
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      {/* Money first: it is the question the business asks of this screen. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Billed this month"
          value={formatPeso(money.billedThisMonth, "₱0.00")}
          // Not lowercased: "september 2026" reads as a typo, and the full
          // month name wrapped this caption onto two lines.
          change={period ? dayjs(period.monthStart).format("MMM YYYY") : ""}
          icon={<Wallet className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Outstanding"
          value={formatPeso(money.outstanding, "₱0.00")}
          change={`${money.openInvoices} open invoice${money.openInvoices === 1 ? "" : "s"}`}
          icon={<CircleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Overdue"
          value={formatPeso(money.overdue, "₱0.00")}
          change="past the due date"
          icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Monthly recurring"
          value={formatPeso(service.monthlyRecurring, "₱0.00")}
          change={`${service.active} active subscription${service.active === 1 ? "" : "s"}`}
          icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="lg:col-span-2">
          <ChartCard
            title="Billed and collected"
            subtitle="Last six months. The gap between them is the collection lag."
            height={300}
          >
            <BilledVsCollected data={series} />
          </ChartCard>
        </div>

        <NeedsAttention items={attention} />
      </div>

      {/* Service and network state: what is actually switched on right now. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          title="Active"
          value={service.active}
          change="subscriptions"
          icon={<CircleCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Suspended"
          value={service.suspended}
          change="no service"
          icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Pending"
          value={service.pending}
          change="awaiting install"
          icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Modems up"
          value={network.onusActive}
          change="active at the OLT"
          icon={<Router className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Modems cut"
          value={network.onusSuspended}
          change="blacklisted"
          icon={<Router className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Not provisioned"
          value={network.onusUnprovisioned}
          change="in stock or unseated"
          icon={<Router className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
