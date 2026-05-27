import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntProvider, ConfigProvider } from "antd";
import { useMemo } from "react";
import RootRoutes from "./routes";
import { useThemeStore } from "./store/themeStore";
import { getAntdTheme } from "./theme/antdTheme";
import "@ant-design/v5-patch-for-react-19";

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
  // Drives both the CSS `.dark` class (via the store) and Ant Design's algorithm
  const mode = useThemeStore((s) => s.mode);
  // Rebuild the antd theme object only when the mode actually changes.
  const antdTheme = useMemo(() => getAntdTheme(mode), [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme}>
        <AntProvider>
          <RootRoutes />
        </AntProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
