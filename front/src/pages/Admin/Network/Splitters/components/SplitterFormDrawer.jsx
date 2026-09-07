import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GitBranch, Loader2, MapPin, Plus, Split, X } from "lucide-react";

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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../../hooks/useDiscardGuard";
import {
  useCreateSplitter,
  useUpdateSplitter,
} from "../../../../../services/requests/admin/network/splitters";

const RATIOS = ["1:2", "1:4", "1:8", "1:16", "1:32", "1:64"];

/**
 * The parent is polymorphic, but a `<Select>` holds one string. So the option
 * value carries both parts — `"pon_port:<id>"` — and is split on submit. That
 * keeps the two fields impossible to desynchronise, which a pair of separate
 * inputs would not.
 */
const PARENT_SEPARATOR = ":";
const encodeParent = (type, id) => `${type}${PARENT_SEPARATOR}${id}`;
const decodeParent = (value) => {
  const idx = value.indexOf(PARENT_SEPARATOR);
  return { parentType: value.slice(0, idx), parentId: value.slice(idx + 1) };
};

const schema = z.object({
  parent: z.string().min(1, "Select what feeds this splitter"),
  ratio: z.enum(RATIOS),
  label: z.string().trim().min(1, "Label is required").max(120),
  location: z.string().max(190, "Must be 190 characters or fewer"),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = { parent: "", ratio: "1:8", label: "", location: "", status: "Active" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const SplitterFormDrawer = ({
  open,
  onClose,
  onSuccess,
  entity = null,
  parentOptions = { ports: [], splitters: [] },
}) => {
  const isEditMode = !!entity;

  const createMutation = useCreateSplitter();
  const updateMutation = useUpdateSplitter();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            parent: encodeParent(entity.parentType, entity.parentId),
            ratio: RATIOS.includes(entity.ratio) ? entity.ratio : "1:8",
            label: entity.label ?? "",
            location: entity.location ?? "",
            status: entity.status === "Inactive" ? "Inactive" : "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "splitter",
    onClose: handleClose,
    label: "SplitterFormDrawer",
  });

  const onSubmit = async (values) => {
    const { parentType, parentId } = decodeParent(values.parent);
    const payload = {
      parentType,
      parentId,
      ratio: values.ratio,
      label: values.label,
      location: values.location || null,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          splitterId: entity.splitterId,
          data: { ...payload, status: values.status },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("Splitter submission error:", error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

  // A splitter cannot be its own parent, so it is removed from its own list.
  // Deeper loops are refused by the API, which can see the whole chain.
  const selectableSplitters = parentOptions.splitters.filter(
    (s) => !isEditMode || s.value !== entity?.splitterId,
  );

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
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit splitter" : "Add splitter"}
        </SheetTitle>

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
                    <Split className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Splitter" : "Add Splitter"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      Passive optical split — inventory and topology only
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

              <SectionLabel>Placement</SectionLabel>

              <FormField
                control={form.control}
                name="parent"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Fed from {req}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select a PON port or splitter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {parentOptions.ports.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>PON ports</SelectLabel>
                            {parentOptions.ports.map((p) => (
                              <SelectItem key={p.value} value={encodeParent("pon_port", p.value)}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {selectableSplitters.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Splitters (cascade)</SelectLabel>
                            {selectableSplitters.map((s) => (
                              <SelectItem key={s.value} value={encodeParent("splitter", s.value)}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      Cascading is allowed — a 1:8 can feed several 1:16s.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label {req}</FormLabel>
                      <div className="relative">
                        <GitBranch
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input placeholder="e.g., SPL-A1" className="h-10 pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ratio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Split ratio {req}</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RATIOS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="mt-5">
                    <FormLabel>Location</FormLabel>
                    <div className="relative">
                      <MapPin
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input
                          placeholder="e.g., Cabinet A, pole 14"
                          className="h-10 pl-9"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Status</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Splitter status {req}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full sm:w-60">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button type="button" variant="outline" size="lg" onClick={guardedClose}>
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button type="submit" size="lg" disabled={saveDisabled || isPending}>
                      {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                      {isEditMode ? "Update Splitter" : "Add Splitter"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {saveDisabled && <TooltipContent>No changes to save yet</TooltipContent>}
              </Tooltip>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default SplitterFormDrawer;
