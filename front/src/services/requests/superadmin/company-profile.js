import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getCompanyProfileApi,
  updateCompanyProfileApi,
} from "../../api/superadmin/company-profile";

// Query: the company profile
export const useGetCompanyProfile = () => {
  return useQuery({
    queryKey: ["companyProfile"],
    queryFn: getCompanyProfileApi,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutation: update the company profile
export const useUpdateCompanyProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCompanyProfileApi,
    onSuccess: () => {
      toast.success("Company profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["companyProfile"] });
      // The companies list renders the same name, email and logo.
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update company profile",
      );
    },
  });
};
