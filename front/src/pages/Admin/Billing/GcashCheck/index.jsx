import dayjs from "dayjs";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  FileUp,
  SearchCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useGcashCheckData, VIEWS } from "./hooks";
import UploadStatementDrawer from "./components/UploadStatementDrawer";
import DataTable from "../../../../components/DataTable";
import PageHeader from "../../../../components/PageHeader";
import RefreshButton from "../../../../components/RefreshButton";
import StatCard from "../../../../components/StatCard";

const periodLabel = (s) =>
  `${dayjs(s.periodStart).format("MMM D")} – ${dayjs(s.periodEnd).format("MMM D, YYYY")}`;

const panelStyle = { border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" };

const STEPS = [
  "In the GCash app, request the transaction history for the dates you want to check.",
  "Download the password-protected PDF GCash sends.",
  "Upload it here and type the PDF password. Neither is saved.",
];

const GcashCheckPage = () => {
  const {
    canWrite,
    statements,
    statementId,
    setSelectedId,
    statement,
    summary,
    activeView,
    setView,
    rows,
    columns,
    isLoading,
    isFetching,
    error,
    refetch,
    uploadOpen,
    handleOpenUpload,
    handleCloseUpload,
    handleUploaded,
    handleDeleteStatement,
    isDeleting,
  } = useGcashCheckData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading the GCash check</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasStatements = statements.length > 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="GCash Check"
        subtitle="Compare the payments staff recorded with TERANETWORK's GCash transaction history."
        actions={
          canWrite && (
            <Button onClick={handleOpenUpload}>
              <FileUp />
              Upload statement
            </Button>
          )
        }
      />

      {!isLoading && !hasStatements ? (
        <div className="bg-surface px-6 py-10" style={panelStyle}>
          <div className="mx-auto max-w-xl text-center">
            <SearchCheck
              className="w-8 h-8 mx-auto"
              style={{ color: "var(--color-text-muted)" }}
            />
            <h2
              className="mt-3 mb-1 font-semibold"
              style={{ fontSize: 16, color: "var(--color-text-dark)" }}
            >
              No statement checked yet
            </h2>
            <p className="m-0" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              The check catches mistyped references, fake screenshots, and payments that
              arrived but were never recorded.
            </p>
            <ol
              className="mt-5 mb-6 text-left space-y-2 pl-5 list-decimal"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {canWrite && (
              <Button onClick={handleOpenUpload}>
                <FileUp />
                Upload statement
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Select value={statementId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-9 w-full sm:w-72">
                  <SelectValue placeholder="Choose a statement" />
                </SelectTrigger>
                <SelectContent>
                  {statements.map((s) => (
                    <SelectItem key={s.statementId} value={s.statementId}>
                      {periodLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statement && (
                <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  {statement.creditCount} incoming · uploaded{" "}
                  {dayjs(statement.dateCreated).format("MMM D, h:mm A")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canWrite && statementId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteStatement}
                  disabled={isDeleting}
                >
                  <Trash2 />
                  Remove
                </Button>
              )}
              <RefreshButton onRefresh={refetch} isFetching={isFetching} />
            </div>
          </div>

          {/* The notification: most likely one payment typed wrong, and fixing
              it clears a "not in the file" and a "not recorded" at once. */}
          {summary.possibleTypos > 0 && (
            <Alert>
              <TriangleAlert style={{ color: "var(--color-warning)" }} />
              <AlertTitle>
                {summary.possibleTypos} possible typo{summary.possibleTypos === 1 ? "" : "s"} in
                recorded references
              </AlertTitle>
              <AlertDescription>
                A reference staff typed is one or two characters away from a reference in the
                statement. Check each pair and use the statement&apos;s reference if it is the
                same payment.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              title="Matched"
              value={summary.matched}
              change="confirmed"
              icon={<CircleCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
            />
            <StatCard
              title="Amount differs"
              value={summary.amountDiffers}
              change="same reference"
              icon={<CircleHelp className="w-4.25 h-4.25" strokeWidth={1.8} />}
            />
            <StatCard
              title="Recorded, not in the file"
              value={summary.recordedNotInFile}
              change="typo or fake proof"
              icon={<CircleX className="w-4.25 h-4.25" strokeWidth={1.8} />}
            />
            <StatCard
              title="In the file, not recorded"
              value={summary.inFileNotRecorded}
              change="may still be cut off"
              icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
            />
          </div>

          <div className="bg-surface overflow-hidden" style={panelStyle}>
            <div
              className="flex flex-col gap-3 px-4.5 py-3.5"
              style={{ borderBottom: "1px solid var(--color-line)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(VIEWS).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className="h-8 px-3 text-[13px] cursor-pointer inline-flex items-center gap-2 transition-colors"
                    style={{
                      borderRadius: 8,
                      border: "1px solid var(--color-line)",
                      background:
                        activeView === key ? "var(--color-surface-sunken)" : "transparent",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span
                      style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }}
                    />
                    {meta.label}
                    <span className="font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {summary[key]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                {VIEWS[activeView].hint}
              </p>
            </div>

            {!isLoading && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <CircleCheck className="w-8 h-8" style={{ color: "var(--color-success)" }} />
                <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
                  Nothing here
                </p>
              </div>
            ) : (
              <DataTable
                dataSource={rows}
                columns={columns}
                rowKey="key"
                loading={isLoading}
                scroll={{ x: 820 }}
              />
            )}
          </div>
        </>
      )}

      <UploadStatementDrawer
        open={uploadOpen}
        onClose={handleCloseUpload}
        onSuccess={handleUploaded}
      />
    </div>
  );
};

export default GcashCheckPage;
