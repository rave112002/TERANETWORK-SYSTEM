import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { message } from "antd";
import {
  getOrganizationsApi,
  getOrganizationByIdApi,
  createOrganizationApi,
  updateOrganizationApi,
  deleteOrganizationApi,
} from "../../api/superadmin/organizations";

// Query: Get all organizations
export const useGetOrganizations = (filters = {}) => {
  return useQuery({
    queryKey: ["organizations", filters],
    queryFn: () => getOrganizationsApi(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
  });
};

// Query: Get single organization
export const useGetOrganizationById = (organizationId) => {
  return useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => getOrganizationByIdApi(organizationId),
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation: Create organization
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrganizationApi,
    onSuccess: () => {
      message.success("Organization created successfully");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to create organization",
      );
    },
  });
};

// Mutation: Update organization
export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ organizationId, organizationData }) =>
      updateOrganizationApi(organizationId, organizationData),
    onSuccess: (data, variables) => {
      message.success("Organization updated successfully");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({
        queryKey: ["organizations", variables.organizationId],
      });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to update organization",
      );
    },
  });
};

// Mutation: Delete organization
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOrganizationApi,
    onSuccess: () => {
      message.success("Organization deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to delete organization",
      );
    },
  });
};
