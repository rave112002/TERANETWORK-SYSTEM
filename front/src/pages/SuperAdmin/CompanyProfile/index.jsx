import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CircleAlert,
  CloudUpload,
  Globe,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import PageHeader from "../../../components/PageHeader";
import SectionLabel from "../../../components/SectionLabel";
import Spinner from "../../../components/Spinner";
import { uploadLogoApi } from "../../../services/api/upload";
import {
  useGetCompanyProfile,
  useUpdateCompanyProfile,
} from "../../../services/requests/superadmin/company-profile";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../utils/phoneFormat";
import { getImageUrl, validateImageFile } from "../../../utils/upload";

const MAX_FILE_MB = 2;

// Required-ness mirrors `companies` in back/database/schema.sql: name and email
// are NOT NULL, everything else is NULLable — so the optional fields validate
// shape, not presence.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(100, "Must be 100 characters or fewer"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email")
    .max(100, "Must be 100 characters or fewer"),
  phone: zPhone,
  website: z
    .string()
    .max(255, "Must be 255 characters or fewer")
    .refine(
      (v) => v === "" || /^https?:\/\/.+/.test(v),
      "Website must start with http:// or https://",
    ),
  address: z.string().max(500, "Must be 500 characters or fewer"),
  tin: z.string().max(20, "Must be 20 characters or fewer"),
});

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  tin: "",
};

const CompanyProfile = () => {
  const { data, isLoading, error } = useGetCompanyProfile();
  const updateMutation = useUpdateCompanyProfile();
  const company = data?.data?.company;

  const fileInputRef = useRef(null);
  // `undefined` means "the user has not touched the logo", so the server's
  // value shows through; `null` means they explicitly removed it. Keeping that
  // distinction in one value avoids setting state from the data effect, which
  // would cascade a render every time the query resolves.
  const [stagedPreview, setStagedPreview] = useState(undefined);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (!company) return;
    form.reset({
      name: company.name ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      website: company.website ?? "",
      address: company.address ?? "",
      tin: company.tin ?? "",
    });
  }, [company, form]);

  const savedPreview = company?.logoUrl ? getImageUrl(company.logoUrl) : null;
  const logoPreview = stagedPreview === undefined ? savedPreview : stagedPreview;
  const logoCleared = stagedPreview === null && savedPreview !== null;

  // A staged or removed logo is an unsaved change even when no field was typed.
  const dirty = isDirty || !!logoFile || logoCleared;
  const saving = uploading || updateMutation.isPending;

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = validateImageFile(file, { maxSizeMB: MAX_FILE_MB });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setStagedPreview(reader.result);
    reader.readAsDataURL(file);
    setLogoFile(file);
  };

  const handleRemoveLogo = () => {
    setStagedPreview(null);
    setLogoFile(null);
  };

  const onSubmit = async (values) => {
    try {
      // Upload first, then save the returned path. The profile endpoint takes
      // JSON — it stores a logo path, it does not receive the file itself.
      let logoUrl = logoCleared ? null : (company?.logoUrl ?? null);
      if (logoFile) {
        setUploading(true);
        const uploaded = await uploadLogoApi(
          logoFile,
          "superadmin",
          company?.companyId,
        );
        logoUrl = uploaded?.data?.path ?? null;
      }

      await updateMutation.mutateAsync({
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        website: values.website || null,
        address: values.address || null,
        tin: values.tin || null,
        logoUrl,
      });

      setLogoFile(null);
      setStagedPreview(undefined);
      form.reset(values);
    } catch (submitError) {
      console.error("Company profile submission error:", submitError);
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Failed to load the company profile</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Company Profile"
        subtitle="Branding and contact details shown on invoices and customer emails."
      />

      <div
        className="max-w-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="large" />
          </div>
        ) : (
          <div className="px-4.5 py-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
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
                        style={{
                          borderRadius: "50%",
                          background: "var(--color-error)",
                        }}
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
                      Appears on invoice PDFs and emails. Max {MAX_FILE_MB}MB.
                      <br />
                      Supported: JPG, PNG, GIF, WebP
                    </p>
                  </div>
                </div>

                <div className="mt-7">
                  <SectionLabel>Company details</SectionLabel>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>
                          Company name{" "}
                          <span style={{ color: "var(--color-error)" }}>*</span>
                        </FormLabel>
                        <div className="relative">
                          <Building2
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="e.g., Tera Network"
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
                    name="tin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TIN</FormLabel>
                        <div className="relative">
                          <Hash
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="e.g., 000-123-456-000"
                              className="h-10 pl-9"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-7">
                  <SectionLabel>Contact</SectionLabel>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>
                          Email{" "}
                          <span style={{ color: "var(--color-error)" }}>*</span>
                        </FormLabel>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="billing@teranetwork.ph"
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
                      <FormItem className="mb-5">
                        <FormLabel>Phone number</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>Website</FormLabel>
                        <div className="relative">
                          <Globe
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="https://teranetwork.ph"
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
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Street, barangay, city, province"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <div className="flex items-start justify-between gap-3">
                          <FormMessage />
                          <span
                            className="shrink-0"
                            style={{
                              fontSize: 12,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {field.value?.length ?? 0}/500
                          </span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div
                  className="mt-7 pt-5 flex items-center gap-2 justify-end"
                  style={{ borderTop: "1px solid var(--color-line)" }}
                >
                  <MapPin
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    className="mr-auto"
                    style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                  >
                    Applies company-wide, across every branch.
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button type="submit" size="lg" disabled={!dirty || saving}>
                          {saving && <Loader2 className="animate-spin" />}
                          Save Changes
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!dirty && (
                      <TooltipContent>No changes to save yet</TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfile;
