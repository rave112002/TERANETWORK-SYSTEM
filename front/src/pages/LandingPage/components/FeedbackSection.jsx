import { useState } from "react";
import { CircleAlert, Info, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ResultState from "@/components/ResultState";
import Spinner from "@/components/Spinner";
import { Demo, DemoNote, DemoRow, Section } from "./Showcase";

const RESULT_PRESETS = [
  {
    status: "403",
    title: "Access denied",
    description: "You don't have permission to view this page.",
  },
  {
    status: "404",
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has moved.",
  },
  {
    status: "500",
    title: "Something went wrong",
    description: "We couldn't load this page. Try again in a moment.",
  },
];

const FeedbackSection = () => {
  const [result, setResult] = useState(RESULT_PRESETS[1]);

  return (
    <Section
      id="feedback"
      title="Feedback & status"
      description="Loading, empty and error states — the pieces a page needs before it has data."
    >
      <Demo name="Alert" source="@/components/ui/alert">
        <div className="space-y-3">
          <Alert>
            <Info />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>
              Changes to a role apply to every user assigned to it.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Error loading roles</AlertTitle>
            <AlertDescription>Request failed with status 500</AlertDescription>
          </Alert>
        </div>
        <DemoNote>
          The destructive alert is the standard page-level error state when a
          query fails.
        </DemoNote>
      </Demo>

      <Demo name="Spinner" source="@/components/Spinner">
        <div className="flex items-center justify-around gap-4 py-2">
          <Spinner size="small" />
          <Spinner />
          <Spinner size="large" tip="Loading members…" />
        </div>
        <DemoNote>
          Also the body of <span className="font-mono">ComponentLoader</span> /{" "}
          <span className="font-mono">PageLoader</span> (LoadingFallback.jsx) and
          the DataTable's loading overlay.
        </DemoNote>
      </Demo>

      <Demo wide name="ResultState" source="@/components/ResultState">
        <DemoRow label="status">
          {RESULT_PRESETS.map((p) => (
            <Button
              key={p.status}
              size="sm"
              variant={result.status === p.status ? "default" : "outline"}
              onClick={() => setResult(p)}
            >
              {p.status}
            </Button>
          ))}
        </DemoRow>
        <div
          style={{
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
            background: "var(--color-surface)",
          }}
        >
          <ResultState
            status={result.status}
            title={result.title}
            description={result.description}
            action={
              <Button size="lg">
                <RotateCw />
                Try again
              </Button>
            }
          />
        </div>
      </Demo>
    </Section>
  );
};

export default FeedbackSection;
