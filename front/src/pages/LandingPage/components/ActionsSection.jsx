import { useState } from "react";
import {
  Copy,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/RefreshButton";
import RowActions from "@/components/RowActions";
import ThemeToggle from "@/components/ThemeToggle";
import { confirm } from "@/store/confirmStore";
import { Demo, DemoNote, DemoRow, Section } from "./Showcase";

const ROW_ACTION_ITEMS = [
  {
    key: "view",
    label: "View details",
    icon: <Eye className="w-4 h-4" />,
    onClick: () => toast.info("View details"),
  },
  {
    key: "edit",
    label: "Edit",
    icon: <Pencil className="w-4 h-4" />,
    onClick: () => toast.info("Edit"),
  },
  { type: "divider" },
  {
    key: "delete",
    label: "Delete",
    icon: <Trash2 className="w-4 h-4" />,
    danger: true,
    onClick: () => toast.error("Delete"),
  },
];

const ActionsSection = () => {
  const [fetching, setFetching] = useState(false);

  const fakeRefresh = () => {
    setFetching(true);
    toast.success("Refreshed");
    setTimeout(() => setFetching(false), 1200);
  };

  const askToDelete = async () => {
    const ok = await confirm({
      title: "Delete role",
      description: 'Delete "Branch Manager"? This can\'t be undone.',
      confirmText: "Delete",
      danger: true,
    });
    toast[ok ? "success" : "info"](ok ? "Confirmed" : "Cancelled");
  };

  return (
    <Section
      id="actions"
      title="Actions"
      description="The primary button is inverted monochrome — never the accent, never a gradient."
    >
      <Demo name="Button — variants" source="@/components/ui/button">
        <DemoRow label="variant">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </DemoRow>
        <DemoRow label="with icon / state">
          <Button>
            <Plus />
            New role
          </Button>
          <Button variant="outline">
            <Copy />
            Duplicate
          </Button>
          <Button disabled>
            <Loader2 className="animate-spin" />
            Saving…
          </Button>
        </DemoRow>
      </Demo>

      <Demo name="Button — sizes" source="@/components/ui/button">
        <DemoRow label="size">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </DemoRow>
        <DemoRow label="icon size">
          <Button size="icon-xs" variant="outline">
            <Plus />
          </Button>
          <Button size="icon-sm" variant="outline">
            <Plus />
          </Button>
          <Button size="icon" variant="outline">
            <Plus />
          </Button>
          <Button size="icon-lg" variant="outline">
            <Plus />
          </Button>
        </DemoRow>
      </Demo>

      <Demo name="RefreshButton" source="@/components/RefreshButton">
        <RefreshButton onRefresh={fakeRefresh} isFetching={fetching} />
        <DemoNote>
          Inert while fetching and for a 2s cooldown after — bind
          <span className="font-mono"> isFetching</span>, not
          <span className="font-mono"> isLoading</span>.
        </DemoNote>
      </Demo>

      <Demo name="RowActions" source="@/components/RowActions">
        <div className="flex items-center gap-3">
          <RowActions items={ROW_ACTION_ITEMS} />
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            The ⋮ menu every list row uses — primary action, Edit, divider,
            Delete (danger).
          </span>
        </div>
      </Demo>

      <Demo name="confirm()" source="@/store/confirmStore">
        <DemoRow>
          <Button variant="destructive" onClick={askToDelete}>
            <Trash2 />
            Delete with confirm
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: "Publish changes?",
                description: "The role will be available to users immediately.",
                confirmText: "Publish",
              });
              if (ok) toast.success("Published");
            }}
          >
            <Shield />
            Neutral confirm
          </Button>
        </DemoRow>
        <DemoNote>
          Imperative and awaitable —
          <span className="font-mono"> const ok = await confirm({"{…}"})</span>.
          A single &lt;ConfirmDialog /&gt; host in App renders it.
        </DemoNote>
      </Demo>

      <Demo name="Toasts + ThemeToggle" source="sonner · @/components/ThemeToggle">
        <DemoRow label="toast">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.success("Role created")}
          >
            Success
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.error("Something went wrong")}
          >
            Error
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.warning("Session expires in 2 minutes")}
          >
            Warning
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.promise(
                new Promise((resolve) => setTimeout(resolve, 1400)),
                {
                  loading: "Saving…",
                  success: "Saved",
                  error: "Failed",
                },
              )
            }
          >
            Promise
          </Button>
        </DemoRow>
        <DemoRow label="theme">
          <ThemeToggle />
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Flips the <span className="font-mono">.dark</span> class on
            &lt;html&gt; — every token below follows.
          </span>
        </DemoRow>
      </Demo>
    </Section>
  );
};

export default ActionsSection;
