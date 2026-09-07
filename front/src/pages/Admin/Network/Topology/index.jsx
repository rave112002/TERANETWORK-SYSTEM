import { Box, CircleAlert, Info, Router, Server, Split, Wifi } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useTopologyData } from "./hooks";
import TreeNode from "./components/TreeNode";
import PageHeader from "../../../../components/PageHeader";
import RefreshButton from "../../../../components/RefreshButton";
import StatCard from "../../../../components/StatCard";
import Spinner from "../../../../components/Spinner";

const LEGEND = [
  ["Active", "var(--color-success)"],
  ["Suspended", "var(--color-error)"],
  ["Offline / full", "var(--color-warning)"],
];

const TopologyPage = () => {
  const { tree, counts, truncated, isLoading, isFetching, error, refetch } = useTopologyData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading topology</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load the network tree."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Network Topology"
        subtitle="The fibre plant from head-end to subscriber modem."
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="OLTs"
          value={counts.olts}
          icon={<Server className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="PON ports"
          value={counts.ponPorts}
          icon={<Wifi className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Splitters"
          value={counts.splitters}
          icon={<Split className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="NAPs"
          value={counts.naps}
          icon={<Box className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="ONUs"
          value={counts.onus}
          icon={<Router className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

      {/* The tree is assembled from one page of each list. Saying so is better
          than showing a partial plant as though it were complete. */}
      {truncated.length > 0 && (
        <Alert>
          <Info />
          <AlertTitle>Showing part of the network</AlertTitle>
          <AlertDescription>
            More than 100 {truncated.join(", ")} exist, so the tree below is incomplete. Use the
            individual inventory pages to see everything.
          </AlertDescription>
        </Alert>
      )}

      <div
        className="bg-surface overflow-hidden"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div
          className="flex items-center gap-4 flex-wrap px-4.5 py-3"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          {LEGEND.map(([label, color]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
              {label}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="large" />
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              No network inventory yet
            </p>
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Add an OLT first, then work down: PON ports, splitters, NAPs, ONUs.
            </p>
          </div>
        ) : (
          <div className="p-3">
            <ul role="tree" aria-label="Network topology" className="list-none m-0 p-0">
              {tree.map((node) => (
                <TreeNode key={node.key} node={node} level={1} defaultOpen />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopologyPage;
