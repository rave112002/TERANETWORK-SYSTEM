import { Button } from "antd";
import { Compass } from "lucide-react";
import { useNavigate } from "react-router";

/**
 * Styled 404 for use inside a portal layout's content area.
 * @param {{ homePath?: string }} props
 */
const NotFound = ({ homePath = "/" }) => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div
        className="flex flex-col items-center justify-center text-center px-6 py-20"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <span
          className="inline-flex items-center justify-center mb-5"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--color-surface-sunken)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text-muted)",
          }}
        >
          <Compass className="w-5.5 h-5.5" strokeWidth={1.8} />
        </span>
        <p
          className="m-0 font-mono"
          style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--color-text-muted)" }}
        >
          404
        </p>
        <h1
          className="m-0 mt-2 font-semibold"
          style={{ fontSize: 22, letterSpacing: "-0.4px", color: "var(--color-text-dark)" }}
        >
          Page not found
        </h1>
        <p
          className="m-0 mt-1.5 mb-6 max-w-sm"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <Button type="primary" size="large" onClick={() => navigate(homePath)}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
