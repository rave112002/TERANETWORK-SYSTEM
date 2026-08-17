import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Eye,
  Pencil,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import DataTable from "@/components/DataTable";
import DescriptionList from "@/components/DescriptionList";
import PageHeader from "@/components/PageHeader";
import PaginationFooter from "@/components/PaginationFooter";
import RefreshButton from "@/components/RefreshButton";
import RowActions from "@/components/RowActions";
import SearchInput from "@/components/SearchInput";
import StatCard from "@/components/StatCard";
import { Demo, DemoNote, DemoRow, Section } from "./Showcase";

const MEMBERS = [
  { id: "1", name: "Maria Santos", email: "maria@acme.test", role: "Administrator", status: "Active" },
  { id: "2", name: "Jose Rizal", email: "jose@acme.test", role: "Branch Manager", status: "Active" },
  { id: "3", name: "Andres Bonifacio", email: "andres@acme.test", role: "Staff", status: "Inactive" },
  { id: "4", name: "Gabriela Silang", email: "gabriela@acme.test", role: "Auditor", status: "Active" },
  { id: "5", name: "Apolinario Mabini", email: "apolinario@acme.test", role: "Staff", status: "Active" },
];

const initials = (name) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const StatusDot = ({ status }) => {
  const active = status === "Active";
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active
            ? "var(--color-success)"
            : "var(--color-text-muted)",
          boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
        }}
      />
      {status}
    </span>
  );
};

const DataDisplaySection = () => {
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: MEMBERS.length,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [fetching, setFetching] = useState(false);
  const { current, pageSize } = pagination;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MEMBERS;
    return MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [search]);

  // The real pages page server-side; here we slice locally so the pager works.
  const pagedRows = useMemo(() => {
    const start = (current - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, current, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "index",
        width: 60,
        render: (_v, _r, index) => (
          <span
            className="font-mono"
            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
          >
            {String((current - 1) * pageSize + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        title: "Member",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_v, record) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar size="sm">
              <AvatarFallback>{initials(record.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className="m-0 truncate"
                style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
              >
                {record.name}
              </p>
              <p
                className="m-0 truncate"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                {record.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        render: (value) => (
          <span
            style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
          >
            {value}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (value) => <StatusDot status={value} />,
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_v, record) => (
          <RowActions
            items={[
              {
                key: "view",
                label: "View details",
                icon: <Eye className="w-4 h-4" />,
                onClick: () => toast.info(`View ${record.name}`),
              },
              {
                key: "edit",
                label: "Edit",
                icon: <Pencil className="w-4 h-4" />,
                onClick: () => toast.info(`Edit ${record.name}`),
              },
              { type: "divider" },
              {
                key: "delete",
                label: "Delete",
                icon: <Trash2 className="w-4 h-4" />,
                danger: true,
                onClick: () => toast.error(`Delete ${record.name}`),
              },
            ]}
          />
        ),
      },
    ],
    [current, pageSize],
  );

  const refresh = () => {
    setFetching(true);
    setTimeout(() => setFetching(false), 900);
  };

  return (
    <Section
      id="data"
      title="Data display"
      description="PageHeader → stat cards → one table card (toolbar + table + pager) is the skeleton every list page follows."
    >
      <Demo wide name="PageHeader" source="@/components/PageHeader">
        <PageHeader
          title="Roles"
          subtitle="Manage roles and the permissions attached to them."
          actions={
            <Button onClick={() => toast.info("New role")}>
              <Plus />
              New role
            </Button>
          }
        />
      </Demo>

      <Demo wide name="StatCard" source="@/components/StatCard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <StatCard
            title="Total roles"
            value="12"
            change="all time"
            icon={<Shield className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
          <StatCard
            title="Active users"
            value="1,284"
            change="this month"
            icon={<Users className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
          <StatCard
            title="Companies"
            value="38"
            change="platform-wide"
            icon={<Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />}
          />
        </div>
      </Demo>

      <Demo
        wide
        name="DataTable + SearchInput + RowActions + PaginationFooter"
        source="@/components/DataTable"
      >
        <div
          className="bg-surface overflow-hidden"
          style={{
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              placeholder="Search members…"
            />
            <div className="flex items-center gap-2">
              <RefreshButton onRefresh={refresh} isFetching={fetching} />
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                Filters
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            dataSource={pagedRows}
            rowKey="id"
            loading={fetching}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            scroll={{ x: 720 }}
            emptyText="No members match that search"
          />

          <PaginationFooter
            pagination={{ ...pagination, total: rows.length }}
            onChange={(p) => setPagination((prev) => ({ ...prev, ...p }))}
            noun="member"
          />
        </div>
        <DemoNote>
          Sortable header on “Member”, a checkbox column via{" "}
          <span className="font-mono">rowSelection</span>, and pagination always
          external — the table itself has no pager.
        </DemoNote>
      </Demo>

      <Demo name="DescriptionList" source="@/components/DescriptionList">
        <DescriptionList
          items={[
            { label: "Role name", value: "Branch Manager" },
            { label: "Company", value: "Acme Corporation" },
            { label: "Phone", value: "0912 3456 789" },
            { label: "Status", value: <StatusDot status="Active" /> },
          ]}
        />
        <DemoNote>The read-only pairing used inside view dialogs.</DemoNote>
      </Demo>

      <Demo name="Avatar" source="@/components/ui/avatar">
        <DemoRow label="sizes">
          <Avatar size="sm">
            <AvatarFallback>MS</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>JR</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>GS</AvatarFallback>
            <AvatarBadge>
              <Check />
            </AvatarBadge>
          </Avatar>
        </DemoRow>
        <DemoRow label="group">
          <AvatarGroup>
            {MEMBERS.slice(0, 3).map((m) => (
              <Avatar key={m.id}>
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
            ))}
            <AvatarGroupCount>+9</AvatarGroupCount>
          </AvatarGroup>
        </DemoRow>
      </Demo>

      <Demo name="Badge" source="@/components/ui/badge">
        <DemoRow label="variant">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="ghost">Ghost</Badge>
        </DemoRow>
        <DemoRow label="in context">
          <Badge variant="secondary">
            <Shield />
            read
          </Badge>
          <Badge variant="outline">write</Badge>
          <Badge variant="destructive">delete</Badge>
        </DemoRow>
      </Demo>

      <Demo name="Separator & Skeleton" source="@/components/ui/separator · skeleton">
        <div className="flex items-center gap-3" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          <span>Profile</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Security</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Sessions</span>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <DemoNote>Skeletons stand in while a query is loading.</DemoNote>
      </Demo>
    </Section>
  );
};

export default DataDisplaySection;
