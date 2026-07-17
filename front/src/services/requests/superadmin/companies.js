import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { message } from "antd";
import {
  getCompaniesApi,
  getCompanyByIdApi,
  createCompanyApi,
  updateCompanyApi,
  deleteCompanyApi,
} from "../../api/superadmin/companies";

// Query: Get all companies
export const useGetCompanies = (filters = {}) => {
  return useQuery({
    queryKey: ["companies", filters],
    queryFn: () => getCompaniesApi(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
  });
};

// Query: Get single company
export const useGetCompanyById = (companyId) => {
  return useQuery({
    queryKey: ["companies", companyId],
    queryFn: () => getCompanyByIdApi(companyId),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation: Create company
export const useCreateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCompanyApi,
    onSuccess: () => {
      message.success("Company created successfully");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to create company",
      );
    },
  });
};

// Mutation: Update company
export const useUpdateCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, companyData }) =>
      updateCompanyApi(companyId, companyData),
    onSuccess: (data, variables) => {
      message.success("Company updated successfully");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({
        queryKey: ["companies", variables.companyId],
      });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to update company",
      );
    },
  });
};

// Mutation: Delete company
export const useDeleteCompany = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCompanyApi,
    onSuccess: () => {
      message.success("Company deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to delete company",
      );
    },
  });
};
