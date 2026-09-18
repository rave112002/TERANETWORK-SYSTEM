import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Building2, Globe, Hash, Loader2, Mail, Phone } from "lucide-react";

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

import SectionLabel from "../../../../components/SectionLabel";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";

/**
 * The company details a branch prints on invoices and emails.
 *
 * Required-ness mirrors `companies` in back/database/schema.sql: name and email
 * are NOT NULL, the rest is optional, so optional fields validate shape only.
 */
const schema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100, "Must be 100 characters or fewer"),
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
    .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Website must start with http:// or https://"),
  address: z.string().max(500, "Must be 500 characters or fewer"),
  tin: z.string().max(20, "Must be 20 characters or fewer"),
});

const FIELDS = ["name", "email", "phone", "website", "address", "tin"];

const toValues = (company) =>
  Object.fromEntries(FIELDS.map((key) => [key, company?.[key] ?? ""]));

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const IconInput = ({ icon: Icon, field, ...props }) => (
  <div className="relative">
    <Icon
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
      style={{ color: "var(--color-text-muted)" }}
    />
    <FormControl>
      <Input className="h-10 pl-9" {...field} {...props} />
    </FormControl>
  </div>
);

const CompanyDetailsForm = ({ company, branchName, saving, onSave }) => {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toValues(null) });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    form.reset(toValues(company));
  }, [company, form]);

  const onSubmit = async (values) => {
    const result = await onSave(values);
    if (result.ok) {
      form.reset(values);
      return;
    }
    result.errors
      .filter((e) => FIELDS.includes(e.field))
      .forEach((e) => form.setError(e.field, { message: e.message }));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
        <SectionLabel>Company details</SectionLabel>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="mb-5">
              <FormLabel>Company name {req}</FormLabel>
              <IconInput icon={Building2} field={field} placeholder="e.g., TERANETWORK" />
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
              <IconInput icon={Hash} field={field} placeholder="e.g., 000-123-456-000" />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-7">
          <SectionLabel>Contact</SectionLabel>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="mb-5">
                <FormLabel>Email {req}</FormLabel>
                <IconInput icon={Mail} field={field} placeholder="billing@teranetwork.ph" />
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
                <IconInput
                  icon={Phone}
                  field={field}
                  placeholder={PHONE_PLACEHOLDER}
                  maxLength={PHONE_MAX_LENGTH}
                  onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}
                />
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
                <IconInput icon={Globe} field={field} placeholder="https://teranetwork.ph" />
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
                  <Textarea placeholder="Street, barangay, city, province" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div
          className="mt-7 pt-5 flex items-center gap-3 justify-end"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <span className="mr-auto" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Saves to <strong>{branchName}</strong> only.
          </span>
          <Button type="submit" size="lg" disabled={!isDirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CompanyDetailsForm;
