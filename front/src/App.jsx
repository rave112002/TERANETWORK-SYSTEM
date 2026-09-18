import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ConfirmDialog from "./components/ConfirmDialog";
// The branch app or the central SuperAdmin app, chosen at build time (vite.config.js).
import RootRoutes from "@app-routes";
import { useThemeStore } from "./store/themeStore";

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => {
  // Drives the CSS `.dark` class (via the store) and the toast theme.
  const mode = useThemeStore((s) => s.mode);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RootRoutes />
        {/* Toast sink (sonner). */}
        <Toaster theme={mode} position="top-right" richColors closeButton />
        {/* Imperative confirm() host. */}
        <ConfirmDialog />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
