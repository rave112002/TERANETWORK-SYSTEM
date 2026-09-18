import { useCallback } from "react";
import { toast } from "sonner";

import { companyLogoUrl } from "../../../services/api/superadmin-console/company";
import {
  useGetCompanyProfile,
  useRemoveCompanyLogo,
  useUpdateCompanyProfile,
  useUploadCompanyLogo,
} from "../../../services/requests/superadmin-console/company";
import { confirm } from "../../../store/confirmStore";
import { useSelectedBranch } from "../components/useSelectedBranch";

/**
 * One branch's company profile: the name, logo, TIN and contact details its
 * invoices and emails print (D10). Read from and saved to that branch directly.
 */

const MAX_LOGO_MB = 2;
const LOGO_TYPES = ["image/png", "image/jpeg"];

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

export const useCompanyProfileData = () => {
  const { branches, branch, selectBranch, isLoading: branchesLoading, error: branchesError } =
    useSelectedBranch();
  const branchId = branch?.branchId;
  const branchName = branch?.name;

  const { data, isLoading, isFetching, error, refetch } = useGetCompanyProfile(branchId);
  const company = data?.data?.company ?? null;

  const updateMutation = useUpdateCompanyProfile();
  const uploadMutation = useUploadCompanyLogo();
  const removeMutation = useRemoveCompanyLogo();

  /** Resolves true when saved, so the form can reset its dirty state. */
  const handleSave = useCallback(
    async (values) => {
      try {
        await updateMutation.mutateAsync({
          branchId,
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          website: values.website || null,
          address: values.address || null,
          tin: values.tin || null,
        });
        toast.success(`Saved to ${branchName}`);
        return { ok: true };
      } catch (err) {
        const body = err?.response?.data;
        if (!body?.errors?.length) toast.error(errorMessage(err, "Could not save the profile"));
        return { ok: false, errors: body?.errors ?? [] };
      }
    },
    [branchId, branchName, updateMutation]
  );

  const handleUploadLogo = useCallback(
    async (file) => {
      if (!LOGO_TYPES.includes(file.type)) {
        toast.error("Use a PNG or JPG image. Invoices cannot show other formats.");
        return;
      }
      if (file.size > MAX_LOGO_MB * 1024 * 1024) {
        toast.error(`The logo must be ${MAX_LOGO_MB} MB or smaller`);
        return;
      }
      try {
        await uploadMutation.mutateAsync({ branchId, file });
        toast.success(`Logo updated on ${branchName}`);
      } catch (err) {
        toast.error(errorMessage(err, "Could not upload the logo"));
      }
    },
    [branchId, branchName, uploadMutation]
  );

  const handleRemoveLogo = useCallback(async () => {
    const ok = await confirm({
      title: "Remove the logo?",
      description: `${branchName}'s invoices will show the company name in text instead.`,
      confirmText: "Remove logo",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeMutation.mutateAsync(branchId);
      toast.success("Logo removed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove the logo"));
    }
  }, [branchId, branchName, removeMutation]);

  return {
    branches,
    branch,
    selectBranch,
    company,
    logoSrc: company?.hasLogo ? companyLogoUrl(branchId, company.logoVersion) : null,
    maxLogoMb: MAX_LOGO_MB,
    isLoading: branchesLoading || (!!branchId && isLoading),
    isFetching,
    loadError: branchesError || error,
    refetch,
    isSaving: updateMutation.isPending,
    isLogoBusy: uploadMutation.isPending || removeMutation.isPending,
    handleSave,
    handleUploadLogo,
    handleRemoveLogo,
  };
};
