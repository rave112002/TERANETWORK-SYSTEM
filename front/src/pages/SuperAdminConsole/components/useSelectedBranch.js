import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { useGetBranches } from "../../../services/requests/superadmin-console/branches";

const STORAGE_KEY = "superadmin-console:branch";

const remembered = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Which branch a per-branch page (Company profile, Users, Settings) is showing.
 *
 * Kept in the URL (`?branch=`) so a link or a reload opens the same branch,
 * and remembered in localStorage so moving between pages keeps it. Falls back
 * to the first branch in the list.
 */
export const useSelectedBranch = () => {
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = useGetBranches();
  const branches = useMemo(() => data?.data?.branches ?? [], [data]);

  const wanted = params.get("branch") || remembered();
  const branch = branches.find((b) => b.branchId === wanted) ?? branches[0] ?? null;

  const selectBranch = useCallback(
    (branchId) => {
      try {
        localStorage.setItem(STORAGE_KEY, branchId);
      } catch {
        // Private mode: the URL still carries it.
      }
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("branch", branchId);
        return next;
      });
    },
    [setParams]
  );

  return { branches, branch, selectBranch, isLoading, error };
};

export default useSelectedBranch;
