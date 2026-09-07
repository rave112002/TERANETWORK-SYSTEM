import { useMemo, useState } from "react";
import { Building2, Home, Loader2, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../components/SectionLabel";
import Spinner from "../../../../components/Spinner";
import { useDiscardGuard } from "../../../../hooks/useDiscardGuard";
import { useGetBranches } from "../../../../services/requests/superadmin/branches";
import {
  useGetUserBranches,
  useUpdateUserBranches,
} from "../../../../services/requests/superadmin/users";
import { decodeHTML } from "../../../../utils/decode-html";

/**
 * Assign a user to one or more branches.
 *
 * This is the access boundary, not a preference: a branch user can only read
 * data from branches listed here. The first selected branch is their HOME
 * branch — where records they create are filed and their uploads are stored.
 *
 * Not a react-hook-form (it is a checkbox list, not a field form), so it passes
 * its own `hasChanges` to the discard guard.
 */
const UserBranchesDrawer = ({ open, onClose, onSuccess, user }) => {
  const [selected, setSelected] = useState([]);

  const { data: assignedData, isLoading: loadingAssigned } = useGetUserBranches(
    open ? user?.accountId : undefined,
  );
  // Gated rather than given placeholder filters: `pageSize: 0` fails the
  // backend's `min: 1` query validation, so an ungated call 400s on every
  // render of the users page while the drawer is shut.
  const { data: branchesData, isLoading: loadingBranches } = useGetBranches(
    { companyId: user?.companyId, pageSize: 100 },
    { enabled: open && !!user?.companyId },
  );
  const updateMutation = useUpdateUserBranches();

  const branches = useMemo(
    () => branchesData?.data?.data || [],
    [branchesData],
  );

  const assignedIds = useMemo(
    () => (assignedData?.data?.branches || []).map((b) => b.branchId),
    [assignedData],
  );

  // Hydrate from the server during render rather than in an effect — React's
  // "adjusting state when props change" pattern. An effect here would set state
  // synchronously on every open and cascade an extra render.
  const hydrationKey = `${user?.accountId ?? ""}:${assignedIds.join(",")}`;
  const [hydratedFor, setHydratedFor] = useState(null);

  if (open && hydratedFor !== hydrationKey) {
    setHydratedFor(hydrationKey);
    setSelected(assignedIds);
  } else if (!open && hydratedFor !== null) {
    // Clear on close so reopening the same user re-hydrates from a fresh fetch.
    setHydratedFor(null);
    setSelected([]);
  }

  // Order-sensitive: the first entry becomes the home branch, so a reordering
  // is a real change even when the same branches are ticked.
  const hasChanges =
    selected.length !== assignedIds.length ||
    selected.some((id, i) => id !== assignedIds[i]);

  const handleClose = () => onClose();

  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty: hasChanges,
    isSubmitSuccessful: false,
    noun: "branch assignment",
    onClose: handleClose,
    label: "UserBranchesDrawer",
  });

  const toggle = (branchId) => {
    setSelected((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        accountId: user.accountId,
        branchIds: selected,
      });
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("Branch assignment error:", error);
    }
  };

  const isLoading = loadingAssigned || loadingBranches;
  const saveDisabled = !hasChanges || selected.length === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) guardedClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Manage branch access</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3 mb-7">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                  <MapPin className="w-5.5 h-5.5 text-white" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="m-0 font-semibold leading-tight"
                    style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                  >
                    Manage branch access
                  </h2>
                  <p
                    className="m-0 mt-0.5 truncate"
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {decodeHTML(user?.fullName) || "User"} ·{" "}
                    {decodeHTML(user?.companyName) || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={guardedClose}
                aria-label="Close"
                className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <SectionLabel>Branches</SectionLabel>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="large" />
              </div>
            ) : branches.length === 0 ? (
              <p
                className="m-0 py-6"
                style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}
              >
                This company has no branches yet. Create one first.
              </p>
            ) : (
              <div className="space-y-2">
                {branches.map((branch) => {
                  const checked = selected.includes(branch.branchId);
                  const isHome = selected[0] === branch.branchId;
                  return (
                    <label
                      key={branch.branchId}
                      className="flex items-center gap-3 cursor-pointer transition-colors hover:bg-(--color-surface-sunken)"
                      style={{
                        border: "1px solid var(--color-line)",
                        borderRadius: "var(--radius-card)",
                        padding: "12px 14px",
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(branch.branchId)}
                      />
                      <Building2
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate"
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "var(--color-text-dark)",
                          }}
                        >
                          {decodeHTML(branch.name)}
                        </div>
                        {branch.address && (
                          <div
                            className="truncate"
                            style={{
                              fontSize: 12.5,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {decodeHTML(branch.address)}
                          </div>
                        )}
                      </div>
                      {isHome && (
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--color-text-secondary)",
                            border: "1px solid var(--color-line)",
                            borderRadius: 999,
                            padding: "3px 9px",
                          }}
                        >
                          <Home className="w-3 h-3" />
                          Home
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            <p
              className="m-0 mt-4"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              The first branch selected becomes the home branch — where records
              this user creates are filed. At least one branch is required; to
              remove all access, deactivate the account instead.
            </p>
          </div>

          <div
            className="flex justify-end gap-3 p-6 pt-5"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={guardedClose}
            >
              Cancel
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleSave}
                    disabled={saveDisabled || updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    Save Access
                  </Button>
                </span>
              </TooltipTrigger>
              {saveDisabled && (
                <TooltipContent>
                  {selected.length === 0
                    ? "Select at least one branch"
                    : "No changes to save yet"}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserBranchesDrawer;
