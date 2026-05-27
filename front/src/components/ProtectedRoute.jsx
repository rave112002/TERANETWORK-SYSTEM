import { Spin, Result, Button } from "antd";
import { usePermissions } from "../hooks/usePermissions";

/**
 * Protected Route Component
 * Checks if user has required permission before rendering children
 */
export const ProtectedRoute = ({
  children,
  module,
  submodule = null,
  accessLevel = "read",
  fallbackPath = "/admin/dashboard",
}) => {
  const { hasPermission, isLoading, error } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" fullscreen tip="Loading permissions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Result
          status="error"
          title="Failed to Load Permissions"
          subTitle="Unable to verify your access permissions. Please try again."
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          }
        />
      </div>
    );
  }

  if (!hasPermission(module, submodule, accessLevel)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Result
          status="403"
          title="Access Denied"
          subTitle="You don't have permission to access this page."
          extra={
            <Button
              type="primary"
              onClick={() => (window.location.href = fallbackPath)}
            >
              Go to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};
