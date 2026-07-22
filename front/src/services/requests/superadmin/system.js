import { useQuery } from "@tanstack/react-query";
import { getSystemInfoApi } from "../../api/superadmin/system";

export const useGetSystemInfo = () =>
  useQuery({
    queryKey: ["system-info"],
    queryFn: getSystemInfoApi,
    staleTime: 60 * 1000,
  });
