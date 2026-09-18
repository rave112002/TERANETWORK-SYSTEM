import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { KeyRound, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { useResetBranchUserPassword } from "../../../../services/requests/superadmin-console/users";
import { decodeHTML } from "../../../../utils/decode-html";
import PasswordField from "./PasswordField";
import { MIN_PASSWORD_LENGTH } from "./passwords";

/**
 * Set a new password on a branch login — for someone locked out, or a login
 * that may have been shared. The branch also signs that login out everywhere.
 */

const schema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`).max(255),
});

const ResetPasswordDrawer = ({ open, onClose, branch, user }) => {
  const mutation = useResetBranchUserPassword();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  useEffect(() => {
    if (open) form.reset({ password: "" });
  }, [open, form]);

  const handleClose = () => {
    if (mutation.isPending) return;
    onClose();
  };

  const onSubmit = async ({ password }) => {
    try {
      await mutation.mutateAsync({ branchId: branch.branchId, accountId: user.accountId, password });
      onClose();
    } catch (error) {
      form.setError("password", { message: error.response?.data?.message || "The branch could not reset the password" });
    }
  };

  const name = `${decodeHTML(user?.firstName) ?? ""} ${decodeHTML(user?.lastName) ?? ""}`.trim();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Reset password</SheetTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <KeyRound className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="m-0 font-semibold leading-tight" style={{ fontSize: 19, color: "var(--color-text-dark)" }}>
                      Reset password
                    </h2>
                    <p className="m-0 mt-0.5 truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                      {name || user?.email} · {branch?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-line)", color: "var(--color-text-secondary)" }}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <PasswordField field={field} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div
                className="mt-6 px-4 py-3.5"
                style={{ borderRadius: 10, border: "1px solid var(--color-line)", background: "var(--color-surface-sunken)" }}
              >
                <p className="m-0" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                  <strong>{user?.email}</strong> is signed out on every device and must log in with the new
                  password. Give it to them privately. SuperAdmin does not keep it.
                </p>
              </div>
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{ borderTop: "1px solid var(--color-line)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Reset password
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default ResetPasswordDrawer;
