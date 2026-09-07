import { useState } from "react";
import { CircleAlert, Filter, FileSignature, Plus, WifiOff, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useSubscriptionsData } from "./hooks";
import SubscriptionFormDrawer from "./components/SubscriptionFormDrawer";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import StatCard from "../../../components/StatCard";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";
import { formatPeso } from "../../../utils/currency";

const SubscriptionsPage = () => {
  const {
    data,
    pagination,
    filters,
    customerOptions,
    planOptions,
    onuOptions,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    handleTableChange,
    handleSearch,
    handleFilterChange,
    handleClearFilters,
    drawerOpen,
    selectedSubscription,
    handleCreate,
    handleDrawerClose,
  } = useSubscriptionsData();

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const totalSubscriptions = pagination?.total || 0;
  const activeSubs = data?.filter((s) => s.status === "active") || [];
  const suspended = data?.filter((s) => s.status === "suspended").length || 0;
  // Recurring revenue counts suspended subscriptions too — they are still
  // customers, just ones currently cut off for non-payment.
  const mrr =
    data
      ?.filter((s) => ["active", "suspended"].includes(s.status))
      .reduce((sum, s) => sum + (Number(s.monthlyPrice) || 0), 0) || 0;

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.planId);
  const isEmpty = !isLoading && (data?.length || 0) === 0;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading subscriptions</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load subscriptions."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Subscriptions"
        subtitle="Who is on which plan, through which modem — and what the billing cycle will pick up."
        actions={
          canWrite && (
            <Button onClick={handleCreate}>
              <Plus />
              New subscription
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Total"
          value={totalSubscriptions}
          change="all branches you can see"
          icon={<FileSignature className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Active"
          value={activeSubs.length}
          change="on this page"
          icon={<FileSignature className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Suspended"
          value={suspended}
          change="cut off for non-payment"
          icon={<WifiOff className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Monthly recurring"
          value={formatPeso(mrr)}
          change="active + suspended, this page"
          icon={<Wallet className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

      <div
        className="bg-surface overflow-hidden"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <SearchInput
            value={filters.search}
            onChange={handleSearch}
            placeholder="Search subscriber, account no, MAC…"
          />
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            <Button
              variant={isFilterVisible || hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFilterVisible(!isFilterVisible)}
            >
              <Filter />
              Filters
            </Button>
          </div>
        </div>

        {isFilterVisible && (
          <div
            className="flex items-end gap-3 flex-wrap px-4.5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <div className="flex flex-col gap-1.5">
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Status
              </span>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-50">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-muted)",
                }}
              >
                Plan
              </span>
              <Select
                value={filters.planId || "all"}
                onValueChange={(v) => handleFilterChange("planId", v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-10 w-60">
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {planOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-8 text-[13px] cursor-pointer hover:underline"
                style={{ color: "var(--color-link)" }}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No subscriptions found
            </p>
            {canWrite && (
              <Button onClick={handleCreate}>
                <Plus />
                New subscription
              </Button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              dataSource={data}
              columns={columns}
              rowKey="subscriptionId"
              loading={isLoading}
              scroll={{ x: 1000 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="subscription"
            />
          </>
        )}
      </div>

      <SubscriptionFormDrawer
        open={drawerOpen}
        entity={selectedSubscription}
        customerOptions={customerOptions}
        planOptions={planOptions}
        onuOptions={onuOptions}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerClose}
      />
    </div>
  );
};

export default SubscriptionsPage;
