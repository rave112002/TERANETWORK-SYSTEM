import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Globe, Loader2, Server, Tag, X } from "lucide-react";

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

import PasswordInput from "../../../../components/PasswordInput";
import SectionLabel from "../../../../components/SectionLabel";
import {
  useCreateBranch,
  useUpdateBranch,
} from "../../../../services/requests/superadmin-console/branches";

/**
 * Add a branch to SuperAdmin, or change its name, address or key.
 *
 * The key is write-only: superadmin-server never sends it back, so on edit the
 * field starts empty and a blank value keeps the stored key. Rules mirror
 * superadmin-server/src/branches.js.
 */

const MIN_KEY_LENGTH = 32;

const buildSchema = (isEdit) =>
  z.object({
    name: z.string().trim().min(1, "Enter the branch name").max(100, "Keep the name under 100 characters"),
    baseUrl: z
      .string()
      .trim()
      .refine((v) => /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i.test(v), "Enter the address, e.g. http://100.64.0.12:8787"),
    apiKey: z
      .string()
      .trim()
      .refine(
        (v) => (isEdit && v === "") || v.length >= MIN_KEY_LENGTH,
        `The key is at least ${MIN_KEY_LENGTH} characters — copy MANAGE_API_KEY from the branch's .env`
      ),
  });

const EMPTY = { name: "", baseUrl: "", apiKey: "" };
const FIELDS = ["name", "baseUrl", "apiKey"];

const req = <span style={{ color: "var(--color-error)" }}>*</span>;
const hint = { fontSize: 12, color: "var(--color-text-muted)" };

const BranchFormDrawer = ({ open, onClose, onSuccess, branch }) => {
  const isEdit = Boolean(branch?.branchId);
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm({ resolver: zodResolver(buildSchema(isEdit)), defaultValues: EMPTY });

  useEffect(() => {
    if (open) {
      form.reset(isEdit ? { name: branch.name, baseUrl: branch.baseUrl, apiKey: "" } : EMPTY);
    }
  }, [open, isEdit, branch, form]);

  const handleClose = () => {
    if (isPending) return;
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      if (isEdit) await updateMutation.mutateAsync({ branchId: branch.branchId, ...values });
      else await createMutation.mutateAsync(values);
      form.reset(EMPTY);
      onSuccess?.();
      onClose();
    } catch (error) {
      const body = error.response?.data;
      const fieldErrors = body?.errors?.filter((e) => FIELDS.includes(e.field)) ?? [];
      if (fieldErrors.length) {
        fieldErrors.forEach((e) => form.setError(e.field, { message: e.message }));
      } else {
        form.setError(body?.code === "DUPLICATE_ENTRY" ? "baseUrl" : "name", {
          message: body?.message || "Could not save the branch",
        });
      }
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
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">{isEdit ? "Edit branch" : "Add branch"}</SheetTitle>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <Server className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="m-0 font-semibold leading-tight" style={{ fontSize: 19, color: "var(--color-text-dark)" }}>
                      {isEdit ? "Edit branch" : "Add branch"}
                    </h2>
                    <p className="m-0 mt-0.5 truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                      {isEdit ? branch.name : "Connect a branch installation over Tailscale"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  disabled={isPending}
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

              <SectionLabel>Branch</SectionLabel>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Name {req}</FormLabel>
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
                      <FormControl>
                        <Input placeholder="e.g., New Lower Bicutan" className="h-10 pl-9" autoFocus {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Address {req}</FormLabel>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
                      <FormControl>
                        <Input placeholder="http://100.64.0.12:8787" className="h-10 pl-9 font-mono" spellCheck={false} {...field} />
                      </FormControl>
                    </div>
                    <p className="m-0 mt-1.5" style={hint}>
                      The branch PC&apos;s Tailscale address and the port its server runs on.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SectionLabel>Access</SectionLabel>

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Management key {!isEdit && req}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder={isEdit ? "Leave blank to keep the current key" : "Paste MANAGE_API_KEY"}
                        autoComplete="new-password"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <p className="m-0 mt-1.5" style={hint}>
                      The value of <span className="font-mono">MANAGE_API_KEY</span> in that branch&apos;s{" "}
                      <span className="font-mono">back/.env</span>. It is stored encrypted and never shown again.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div
                className="px-4 py-3.5"
                style={{ borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-surface-sunken)" }}
              >
                <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                  <strong>No key on the branch yet?</strong> On the branch PC run:
                </p>
                <p className="m-0 mt-2 font-mono break-all" style={{ fontSize: 11.5, color: "var(--color-text-dark)" }}>
                  node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64url&apos;))&quot;
                </p>
                <p className="m-0 mt-2" style={hint}>
                  Put the result in <span className="font-mono">back/.env</span> as{" "}
                  <span className="font-mono">MANAGE_API_KEY=…</span>, restart the branch server, and paste the same value here.
                </p>
              </div>
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{ borderTop: "1px solid var(--color-line)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Server />}
                {isEdit ? "Save changes" : "Add branch"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default BranchFormDrawer;
