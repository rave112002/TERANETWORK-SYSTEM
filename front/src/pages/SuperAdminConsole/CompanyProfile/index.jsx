import { Link } from "react-router";
import { CircleAlert, Server } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useCompanyProfileData } from "./hooks";
import CompanyDetailsForm from "./components/CompanyDetailsForm";
import LogoCard from "./components/LogoCard";
import BranchPicker from "../components/BranchPicker";
import PageHeader from "../../../components/PageHeader";
import RefreshButton from "../../../components/RefreshButton";
import Spinner from "../../../components/Spinner";

const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
};

const CompanyProfilePage = () => {
  const {
    branches,
    branch,
    selectBranch,
    company,
    logoSrc,
    maxLogoMb,
    isLoading,
    isFetching,
    loadError,
    refetch,
    isSaving,
    isLogoBusy,
    handleSave,
    handleUploadLogo,
    handleRemoveLogo,
  } = useCompanyProfileData();

  const noBranches = !isLoading && branches.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Company Profile"
        subtitle="The name, logo, TIN and contact details printed on a branch's invoices and emails."
      />

      <div className="flex items-center justify-between gap-3 flex-wrap max-w-2xl">
        <BranchPicker branches={branches} branch={branch} onChange={selectBranch} />
        {branch && <RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      </div>

      {noBranches ? (
        <div className="max-w-2xl flex flex-col items-center gap-3 py-14 px-6 text-center" style={cardStyle}>
          <Server className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            Add a branch first.
          </p>
          <Button asChild variant="outline">
            <Link to="/superadmin/branches">Go to Branches</Link>
          </Button>
        </div>
      ) : loadError ? (
        <Alert variant="destructive" className="max-w-2xl">
          <CircleAlert />
          <AlertTitle>Could not load {branch?.name ?? "the branch"}&apos;s profile</AlertTitle>
          <AlertDescription>
            {loadError.response?.data?.message || loadError.message}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-w-2xl" style={cardStyle}>
          {isLoading || !company ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="large" />
            </div>
          ) : (
            <div className="px-4.5 py-5 space-y-7">
              <LogoCard
                logoSrc={logoSrc}
                maxLogoMb={maxLogoMb}
                busy={isLogoBusy}
                onUpload={handleUploadLogo}
                onRemove={handleRemoveLogo}
              />
              <CompanyDetailsForm
                company={company}
                branchName={branch?.name}
                saving={isSaving}
                onSave={handleSave}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanyProfilePage;
