import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { TABS, useRecoveryData } from "./hooks";
import PageHeader from "../../../components/PageHeader";
import RefreshButton from "../../../components/RefreshButton";
import SearchInput from "../../../components/SearchInput";
import DataTable from "../../../components/DataTable";

const RecoveryPage = () => {
  const {
    tab,
    setTab,
    search,
    setSearch,
    rows,
    columns,
    recoveryAfterDays,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useRecoveryData();

  const meta = TABS.find((t) => t.key === tab);

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading recovery</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Modem recovery"
        subtitle={meta.subtitle}
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

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
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="h-8 px-3 text-[13px] cursor-pointer transition-colors"
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background: tab === t.key ? "var(--color-surface-sunken)" : "transparent",
                  color:
                    tab === t.key ? "var(--color-text-dark)" : "var(--color-text-secondary)",
                  fontWeight: tab === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Name or account no."
            width={240}
          />
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center">
            <CircleCheck className="w-7 h-7" style={{ color: "var(--color-success)" }} />
            <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
              {meta.empty}
            </p>
            <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              {meta.emptyDetail}
            </p>
          </div>
        ) : (
          <DataTable
            dataSource={rows}
            columns={columns}
            rowKey="subscriptionId"
            loading={isLoading}
            scroll={{ x: 950 }}
          />
        )}
      </div>

      {/* Says where the number on this screen comes from, and that it is only a
          prompt. Somebody looking at a name here should know nothing has
          happened to that account yet. */}
      {tab === "candidates" && recoveryAfterDays && (
        <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          Listed after {recoveryAfterDays} days without service. Nothing here is revoked until
          you mark it. Change the wait on Settings → System.
        </p>
      )}

      {tab === "pending" && !isEmpty && (
        <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          Closing a job frees the NAP port either way. A recovered modem goes back into stock;
          one that could not be recovered stays blacklisted so nobody else can use it.
        </p>
      )}
    </div>
  );
};

export default RecoveryPage;
