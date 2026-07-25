import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getSuperAdminUsersApi,
  createSuperAdminUserApi,
} from "../../api/superadmin/users";

// Query: Get all users (SuperAdmin view)
export const useGetSuperAdminUsers = (filters = {}) => {
  return useQuery({
    queryKey: ["superadmin-users", filters],
    queryFn: () => getSuperAdminUsersApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
  });
};

// Mutation: Create user (Owner for a branch)
export const useCreateSuperAdminUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSuperAdminUserApi,
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });
};
