import { useCallback } from "react";

import {
  useGetBranchSystemSettings,
  useUpdateBranchSystemSettings,
} from "../../../services/requests/superadmin-console/system";
import { useSelectedBranch } from "../components/useSelectedBranch";

/**
 * One branch's runtime settings (dry-run, billing schedule, rules), read from
 * and saved to that branch (D10). The branch applies the same checks and audit
 * as its own System page.
 */
export const useBranchSystemSettingsData = () => {
  const { branches, branch, selectBranch, isLoading: branchesLoading, error: branchesError } =
    useSelectedBranch();
  const branchId = branch?.branchId;

  const { data, isLoading, isFetching, error, refetch } = useGetBranchSystemSettings(branchId);
  const settings = data?.data?.settings ?? null;

  const mutation = useUpdateBranchSystemSettings();

  const handleDryRunChange = useCallback(
    (next) => mutation.mutate({ branchId, DRY_RUN: next }),
    [branchId, mutation]
  );

  const handleSave = useCallback(
    (values) => mutation.mutate({ branchId, ...values }),
    [branchId, mutation]
  );

  return {
    branches,
    branch,
    selectBranch,
    settings,
    isLoading: branchesLoading || (!!branchId && isLoading),
    isFetching,
    loadError: branchesError || error,
    refetch,
    isSaving: mutation.isPending,
    handleDryRunChange,
    handleSave,
  };
};
