import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getCustomersApi,
  getCustomerByIdApi,
  createCustomerApi,
  updateCustomerApi,
  deleteCustomerApi,
} from "../../api/admin/customers";

// Query: list subscribers
export const useGetCustomers = (filters = {}) => {
  return useQuery({
    queryKey: ["customers", filters],
    queryFn: () => getCustomersApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep rows visible while paginating
  });
};

// Query: single subscriber
export const useGetCustomerById = (customerId) => {
  return useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => getCustomerByIdApi(customerId),
    enabled: !!customerId,
    staleTime: 10 * 60 * 1000,
  });
};

// Mutation: create
export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomerApi,
    onSuccess: (response) => {
      // The account number is allocated server-side, so show it back — it is
      // what staff and the customer will quote from here on.
      const accountNo = response?.data?.accountNo;
      toast.success(
        accountNo
          ? `Customer created — account ${accountNo}`
          : "Customer created successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create customer");
    },
  });
};

// Mutation: update
export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, customerData }) =>
      updateCustomerApi(customerId, customerData),
    onSuccess: (_data, variables) => {
      toast.success("Customer updated successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customers", variables.customerId],
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update customer");
    },
  });
};

// Mutation: soft delete
export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomerApi,
    onSuccess: () => {
      toast.success("Customer deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error) => {
      // The API refuses while a live subscription exists — surface that reason.
      toast.error(error.response?.data?.message || "Failed to delete customer");
    },
  });
};
