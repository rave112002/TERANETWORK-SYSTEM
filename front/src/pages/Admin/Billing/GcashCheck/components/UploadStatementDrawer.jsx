import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FileUp, Loader2, ShieldCheck, X } from "lucide-react";

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

import PasswordInput from "../../../../../components/PasswordInput";
import SectionLabel from "../../../../../components/SectionLabel";
import { useUploadPaymentStatement } from "../../../../../services/requests/admin/billing";

/**
 * Uploading TERANETWORK's GCash transaction history to check recorded payments.
 *
 * ── The password is typed here and goes nowhere else ────────────────────────
 *
 * GCash sends the history as a password-protected PDF. The password travels
 * with the file in one request, the server opens the PDF in memory, and
 * neither the file nor the password is saved. The form resets on close so the
 * password does not sit in a hidden drawer either.
 */

const MAX_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  file: z
    .any()
    .refine((f) => f instanceof File, "Choose the PDF")
    .refine((f) => !(f instanceof File) || f.name.toLowerCase().endsWith(".pdf"), "Choose a .pdf file")
    .refine((f) => !(f instanceof File) || f.size <= MAX_BYTES, "The PDF is larger than 10 MB"),
  // Optional on purpose: an unprotected PDF has none, and the server says so
  // when one is needed.
  password: z.string().max(200),
});

const EMPTY = { file: null, password: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const UploadStatementDrawer = ({ open, onClose, onSuccess }) => {
  const uploadMutation = useUploadPaymentStatement();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  const handleClose = () => {
    if (uploadMutation.isPending) return;
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    const data = new FormData();
    data.append("file", values.file);
    data.append("password", values.password);
    try {
      const response = await uploadMutation.mutateAsync(data);
      form.reset(EMPTY);
      onSuccess?.(response);
    } catch (error) {
      const message = error.response?.data?.message || "The statement could not be checked";
      // A password problem belongs under the password field; anything else
      // (wrong file, unreadable PDF) under the file.
      form.setError(/password/i.test(message) ? "password" : "file", { message });
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
        <SheetTitle className="sr-only">Upload GCash statement</SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <FileUp className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      Upload GCash statement
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      Check recorded payments against the transaction history
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  disabled={uploadMutation.isPending}
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

              <SectionLabel>Statement</SectionLabel>

              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Transaction history PDF {req}</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="h-10"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                      />
                    </FormControl>
                    <p className="m-0 mt-1.5" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      In the GCash app, request the transaction history. GCash emails it as a PDF.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="mb-6">
                    <FormLabel>PDF password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="The password GCash gave for this PDF"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div
                className="flex gap-3 px-4 py-3.5"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <ShieldCheck
                  className="w-4.5 h-4.5 shrink-0 mt-0.5"
                  style={{ color: "var(--color-success)" }}
                />
                <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                  <p className="m-0">
                    <strong>The PDF and its password are not saved.</strong> The file is read
                    once to find the money that came in. Only those lines are kept (date,
                    sender, reference, amount). Money going out is ignored.
                  </p>
                  <p className="m-0 mt-2" style={{ color: "var(--color-text-muted)" }}>
                    Statements may overlap. A transaction already checked is not counted twice.
                  </p>
                </div>
              </div>
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
                onClick={handleClose}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="animate-spin" /> : <FileUp />}
                Check statement
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default UploadStatementDrawer;
