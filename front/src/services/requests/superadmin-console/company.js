import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCompanyProfileApi,
  removeCompanyLogoApi,
  updateCompanyProfileApi,
  uploadCompanyLogoApi,
} from "../../api/superadmin-console/company";

const profileKey = (branchId) => ["sa-branches", branchId, "company-profile"];

export const useGetCompanyProfile = (branchId, options = {}) =>
  useQuery({
    queryKey: profileKey(branchId),
    queryFn: () => getCompanyProfileApi(branchId),
    enabled: !!branchId,
    staleTime: 30 * 1000,
    // An offline branch answers 502 quickly; retrying just delays the message.
    retry: false,
    ...options,
  });

/** Every change returns the saved profile, so the cache is set, not refetched. */
const useProfileMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (res, variables) => {
      const branchId = typeof variables === "string" ? variables : variables.branchId;
      queryClient.setQueryData(profileKey(branchId), res);
    },
  });
};

export const useUpdateCompanyProfile = () => useProfileMutation(updateCompanyProfileApi);
export const useUploadCompanyLogo = () => useProfileMutation(uploadCompanyLogoApi);
export const useRemoveCompanyLogo = () => useProfileMutation(removeCompanyLogoApi);
