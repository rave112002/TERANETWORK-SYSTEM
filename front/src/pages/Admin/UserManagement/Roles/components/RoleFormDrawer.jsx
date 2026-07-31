import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Shield, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../../components/SectionLabel";
import StatusToggle from "../../../../../components/StatusToggle";
import {
  createRole,
  updateRole,
} from "../../../../../services/api/admin/roles";

// One zod schema per form. Optional `description` (roles.description is
// TEXT NULL) validates its length only once something is typed.
const roleSchema = z.object({
  roleName: z
    .string()
    .trim()
    .min(3, "Role name must be at least 3 characters")
    .max(50, "Role name must not exceed 50 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .refine(
      (v) => v === "" || v.length >= 10,
      "Description must be at least 10 characters",
    ),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = { roleName: "", description: "", status: "Active" };

const RoleFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const queryClient = useQueryClient();
  const isEditMode = !!entity;

  const form = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: EMPTY,
  });

  const {
    formState: { isDirty },
  } = form;

  // Hydrate on open; map fields explicitly (API responses carry extra keys).
  // form.reset() sets the baseline the dirty check diffs against.
  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            roleName: entity.roleName ?? "",
            description: entity.description ?? "",
            status: entity.status ?? "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create role");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, data }) => updateRole(roleId, data),
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update role");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  // Edit mode: disable save until something actually changed. Create: always on.
  const saveDisabled = isEditMode && !isDirty;

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  // RHF only calls this after validation passes and focuses the first error itself.
  const onSubmit = async (values) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          roleId: entity.roleId,
          data: values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }
      onSuccess?.();
    } catch (error) {
      // mutation errors already surface a toast via onError
      console.error("Form submission error:", error);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit Role" : "Create New Role"}
        </SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header — accent chip + title + subtitle + bordered X */}
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <Shield className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Role" : "Create New Role"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Update role information"
                        : "Define a new role for your company"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
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

              {/* Role details */}
              <SectionLabel>Role details</SectionLabel>

              <FormField
                control={form.control}
                name="roleName"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>
                      Role name{" "}
                      <span style={{ color: "var(--color-error)" }}>*</span>
                    </FormLabel>
                    <div className="relative">
                      <Shield
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input
                          placeholder="e.g., Branch Manager"
                          className="h-10 pl-9"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        maxLength={500}
                        placeholder="Describe what this role can access and do"
                        className="min-h-24 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-center justify-between gap-3">
                      <FormMessage />
                      <span
                        className="ml-auto shrink-0 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {field.value?.length || 0}/500
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              {/* Access status */}
              <div className="mt-7">
                <SectionLabel>Access status</SectionLabel>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Status{" "}
                        <span style={{ color: "var(--color-error)" }}>*</span>
                      </FormLabel>
                      <StatusToggle
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer — hairline top border; Cancel + inverted primary */}
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
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={saveDisabled || isPending}
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      {isEditMode ? "Update Role" : "Create Role"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {saveDisabled && (
                  <TooltipContent>No changes to save yet</TooltipContent>
                )}
              </Tooltip>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default RoleFormDrawer;
