import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, CloudUpload, Loader2, Mail, Phone, Plus, Trash2, X } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../hooks/useDiscardGuard";
import {
  useCreateCompany,
  useUpdateCompany,
} from "../../../../services/requests/superadmin/companies";
import { getImageUrl, validateImageFile } from "../../../../utils/upload";
import { deleteFileApi } from "../../../../services/api/upload";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneNumber,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";

const MAX_FILE_MB = 2;

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  phone: zPhone,
  website: z.string(),
  subscriptionPlan: z.string().min(1, "Please select a subscription plan"),
});

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  website: "",
  subscriptionPlan: "",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const CompanyFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const isEditMode = !!entity;
  const fileInputRef = useRef(null);

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [oldLogoPath, setOldLogoPath] = useState(null);

  const createCompanyMutation = useCreateCompany();
  const updateCompanyMutation = useUpdateCompany();

  const form = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: EMPTY,
  });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    if (entity) {
      form.reset({
        name: entity.name ?? "",
        email: entity.email ?? "",
        phone: entity.phone ?? "",
        website: entity.website ?? "",
        subscriptionPlan: entity.subscriptionPlan ?? "",
      });
      setLogoPreview(
        entity.logo || entity.logoUrl
          ? getImageUrl(entity.logo || entity.logoUrl)
          : null,
      );
      setOldLogoPath(entity.logo || entity.logoUrl || null);
      setLogoFile(null);
    } else {
      form.reset(EMPTY);
      setLogoPreview(null);
      setLogoFile(null);
      setOldLogoPath(null);
    }
  }, [open, entity, form]);

  const dirty = isDirty || !!logoFile;
  const saveDisabled = isEditMode && !dirty;
  const isPending =
    createCompanyMutation.isPending || updateCompanyMutation.isPending;

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file, {
      maxSizeMB: MAX_FILE_MB,
      allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setLogoFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleRemoveLogo = async () => {
    if (oldLogoPath && !oldLogoPath.startsWith("data:")) {
      try {
        await deleteFileApi(oldLogoPath, "superadmin");
      } catch {
        // best-effort
      }
    }
    setLogoPreview(null);
    setLogoFile(null);
    setOldLogoPath(null);
  };

  const handleClose = () => {
    form.reset(EMPTY);
    setLogoPreview(null);
    setLogoFile(null);
    setOldLogoPath(null);
    onClose();
  };

  // Escape / overlay click / X / Cancel all route through this. `dirty`, not
  // `isDirty` — a staged logo is an unsaved change even if no field was typed in.
  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty: dirty,
    isSubmitSuccessful,
    noun: "company",
    onClose: handleClose,
    label: "CompanyFormDrawer",
  });

  const onSubmit = async (values) => {
    const payload = { ...values };
    if (payload.phone) payload.phone = formatPhoneNumber(payload.phone);

    try {
      if (logoFile) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined && value !== null)
            formData.append(key, value);
        });
        formData.append("logo", logoFile);

        if (isEditMode) {
          await updateCompanyMutation.mutateAsync({
            companyId: entity.id || entity.companyId,
            companyData: formData,
          });
        } else {
          await createCompanyMutation.mutateAsync(formData);
        }
      } else {
        if (isEditMode && oldLogoPath) payload.logoUrl = oldLogoPath;

        if (isEditMode) {
          await updateCompanyMutation.mutateAsync({
            companyId: entity.id || entity.companyId,
            companyData: payload,
          });
        } else {
          await createCompanyMutation.mutateAsync(payload);
        }
      }
      markSaved(); // the parent closes us next — don't ask about saved changes
      onSuccess?.();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

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
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit Company" : "Create New Company"}
        </SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <Building2 className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Company" : "Create New Company"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Update company information"
                        : "Branch and owner are created separately"}
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

              {/* Logo */}
              <SectionLabel>Logo</SectionLabel>
              <div className="flex items-start gap-4">
                {logoPreview ? (
                  <div className="relative group">
                    <div
                      className="w-24 h-24 overflow-hidden"
                      style={{
                        borderRadius: 12,
                        border: "1px solid var(--color-line)",
                        background: "var(--color-surface-sunken)",
                      }}
                    >
                      <img
                        src={logoPreview}
                        alt="Company logo preview"
                        className="w-full h-full object-cover"
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      aria-label="Remove logo"
                      className="absolute -top-2 -right-2 w-7 h-7 inline-flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ borderRadius: "50%", background: "var(--color-error)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-24 h-24 flex items-center justify-center"
                    style={{
                      borderRadius: 12,
                      border: "1px dashed var(--color-line)",
                      background: "var(--color-surface-sunken)",
                    }}
                  >
                    <Building2
                      className="w-8 h-8"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                  </div>
                )}

                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <CloudUpload />
                    {logoPreview ? "Change logo" : "Upload logo"}
                  </Button>
                  <p
                    className="m-0 mt-2"
                    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  >
                    Recommended: square image, max {MAX_FILE_MB}MB
                    <br />
                    Supported: JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              {/* Company details */}
              <div className="mt-7">
                <SectionLabel>Company details</SectionLabel>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Company name {req}</FormLabel>
                      <div className="relative">
                        <Building2
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="e.g., Apex Digital Solutions"
                            className="h-10 pl-9"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email {req}</FormLabel>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="org@example.com"
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <div className="relative">
                          <Phone
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder={PHONE_PLACEHOLDER}
                              className="h-10 pl-9"
                              maxLength={PHONE_MAX_LENGTH}
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  formatPhoneOnChange(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem className="mt-5">
                      <FormLabel>Website (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://www.example.com"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Subscription */}
              <div className="mt-7">
                <SectionLabel>Subscription</SectionLabel>
                <FormField
                  control={form.control}
                  name="subscriptionPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan {req}</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select a plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Basic">Basic</SelectItem>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Premium">Premium</SelectItem>
                          <SelectItem value="Enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer */}
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
                      type="submit"
                      size="lg"
                      disabled={saveDisabled || isPending}
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      {isEditMode ? "Update Company" : "Create Company"}
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

export default CompanyFormDrawer;
