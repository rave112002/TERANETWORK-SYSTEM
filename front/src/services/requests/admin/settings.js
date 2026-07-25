import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettingsApi, updateSettingsApi } from "../../api/admin/settings";

export const useGetSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: getSettingsApi,
    staleTime: 5 * 60 * 1000,
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettingsApi,
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to save settings");
    },
  });
};
