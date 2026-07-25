import { Button } from "@/components/ui/button";
import { usePermissions } from "../hooks/usePermissions";
import Spinner from "./Spinner";
import ResultState from "./ResultState";

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
        <Spinner size="large" tip="Loading permissions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <ResultState
          status="error"
          title="Failed to Load Permissions"
          description="Unable to verify your access permissions. Please try again."
          action={
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          }
        />
      </div>
    );
  }

  if (!hasPermission(module, submodule, accessLevel)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <ResultState
          status="403"
          title="Access Denied"
          description="You don't have permission to access this page."
          action={
            <Button onClick={() => (window.location.href = fallbackPath)}>
              Go to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};
