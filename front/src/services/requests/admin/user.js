import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { message } from "antd";
import {
  getUsersApi,
  getUserByIdApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
} from "../../api/admin/user";

// Query: Get all users
export const useGetUsers = (filters = {}) => {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => getUsersApi(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
  });
};

// Query: Get single user
export const useGetUserById = (userId) => {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => getUserByIdApi(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutation: Create user
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserApi,
    onSuccess: () => {
      message.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to create user");
    },
  });
};

// Mutation: Update user
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, userData }) => updateUserApi(userId, userData),
    onSuccess: (data, variables) => {
      message.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.userId] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to update user");
    },
  });
};

// Mutation: Delete user
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => {
      message.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to delete user");
    },
  });
};
