import { Boxes, CircleAlert, Clock, Database, GitBranch, Server, Timer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Spinner from "../../../components/Spinner";
import PageHeader from "../../../components/PageHeader";
import { useGetSystemInfo } from "../../../services/requests/superadmin/system";

const formatUptime = (seconds = 0) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
};

const InfoCard = ({ icon, label, value, valueColor }) => (
  <div
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
      padding: 18,
    }}
  >
    <div className="flex items-center gap-2 mb-2.5">
      <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
      <span
        className="uppercase"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
    </div>
    <p
      className="m-0 font-medium truncate"
      style={{ fontSize: 16, color: valueColor || "var(--color-text-dark)" }}
    >
      {value}
    </p>
  </div>
);

const SystemSettings = () => {
  const { data, isLoading, error } = useGetSystemInfo();
  const sys = data?.data?.system || {};

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="System Settings"
        subtitle="Platform configuration and runtime information."
      />

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Failed to load system information</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <InfoCard
            icon={<Boxes className="w-4 h-4" strokeWidth={1.8} />}
            label="Application"
            value={sys.appName}
          />
          <InfoCard
            icon={<Server className="w-4 h-4" strokeWidth={1.8} />}
            label="Environment"
            value={sys.environment}
          />
          <InfoCard
            icon={<GitBranch className="w-4 h-4" strokeWidth={1.8} />}
            label="Node version"
            value={sys.nodeVersion}
          />
          <InfoCard
            icon={<Clock className="w-4 h-4" strokeWidth={1.8} />}
            label="Timezone"
            value={sys.timezone}
          />
          <InfoCard
            icon={<Timer className="w-4 h-4" strokeWidth={1.8} />}
            label="Uptime"
            value={formatUptime(sys.uptimeSeconds)}
          />
          <InfoCard
            icon={<Database className="w-4 h-4" strokeWidth={1.8} />}
            label="Database"
            value={sys.database === "connected" ? "Connected" : "Unreachable"}
            valueColor={
              sys.database === "connected"
                ? "var(--color-success)"
                : "var(--color-error)"
            }
          />
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
