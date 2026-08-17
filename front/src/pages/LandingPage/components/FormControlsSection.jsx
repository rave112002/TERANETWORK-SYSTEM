import { useState } from "react";
import { Mail, Phone, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DatePicker from "@/components/DatePicker";
import PasswordInput from "@/components/PasswordInput";
import SearchableSelect from "@/components/SearchableSelect";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import SearchInput from "@/components/SearchInput";
import SectionLabel from "@/components/SectionLabel";
import StatusToggle from "@/components/StatusToggle";
import { PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, formatPhoneOnChange } from "@/utils/phoneFormat";
import { Demo, DemoNote, Section } from "./Showcase";
import DemoFormDrawer from "./DemoFormDrawer";

const DESCRIPTION_MAX = 200;

// Local getters only — `toISOString()` would shift the day west of Greenwich.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const NOW = new Date();
const MIN_DATE = ymd(new Date(NOW.getFullYear(), NOW.getMonth(), 1));
const MAX_DATE = ymd(new Date(NOW.getFullYear(), NOW.getMonth() + 2, 0));

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "Branch Manager" },
  { value: "staff", label: "Staff" },
  { value: "auditor", label: "Auditor" },
];

// Long enough (14) to cross SearchableSelect's 12-option search threshold.
const MEMBER_OPTIONS = [
  "Maria Santos",
  "Jose Rizal",
  "Andres Bonifacio",
  "Gabriela Silang",
  "Apolinario Mabini",
  "Melchora Aquino",
  "Emilio Aguinaldo",
  "Juan Luna",
  "Antonio Luna",
  "Marcelo del Pilar",
  "Graciano Lopez",
  "Diego Silang",
  "Teresa Magbanua",
  "Trinidad Tecson",
].map((name, i) => ({
  value: `USR-${String(i + 1).padStart(3, "0")}`,
  label: name,
  hint: i % 3 === 0 ? "Main Branch" : "North Branch",
}));

const FormControlsSection = () => {
  const [search, setSearch] = useState("");
  const [password, setPassword] = useState("Str0ng!pass");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [visibility, setVisibility] = useState("Public");
  const [terms, setTerms] = useState(true);
  const [role, setRole] = useState("manager");
  const [member, setMember] = useState("");
  const [branch, setBranch] = useState("BR-001");
  const [startDate, setStartDate] = useState("");
  const [appointment, setAppointment] = useState("");
  const [bounded, setBounded] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Section
      id="forms"
      title="Form controls"
      description="Controls are h-10 in drawers; icon prefixes sit in a relative wrapper outside FormControl so the label/aria wiring lands on the input."
    >
      <Demo name="Input" source="@/components/ui/input">
        <div className="space-y-3.5">
          <div>
            <Label htmlFor="demo-name">Role name</Label>
            <Input
              id="demo-name"
              className="h-10 mt-2"
              placeholder="e.g., Branch Manager"
            />
          </div>
          <div>
            <Label htmlFor="demo-email">With icon prefix</Label>
            <div className="relative mt-2">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <Input
                id="demo-email"
                className="h-10 pl-9"
                placeholder="name@company.com"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="demo-invalid">Invalid state</Label>
            <Input
              id="demo-invalid"
              className="h-10 mt-2"
              aria-invalid
              defaultValue="not-an-email"
            />
            <p
              className="m-0 mt-1.5"
              style={{ fontSize: 12.5, color: "var(--color-error)" }}
            >
              Enter a valid email address
            </p>
          </div>
          <div>
            <Label htmlFor="demo-disabled">Disabled</Label>
            <Input
              id="demo-disabled"
              className="h-10 mt-2"
              disabled
              defaultValue="admin@company.com"
            />
          </div>
        </div>
      </Demo>

      <Demo name="PasswordInput + strength" source="@/components/PasswordInput">
        <Label htmlFor="demo-password">Password</Label>
        <div className="mt-2">
          <PasswordInput
            id="demo-password"
            placeholder="Enter a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <PasswordStrengthIndicator password={password} />
      </Demo>

      <Demo name="SearchInput" source="@/components/SearchInput">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search roles…"
        />
        <DemoNote>
          The 280px toolbar filter — search icon prefix plus a clear button that
          appears once there's a value.
        </DemoNote>
      </Demo>

      <Demo name="Phone field" source="@/utils/phoneFormat">
        <Label htmlFor="demo-phone">Phone number</Label>
        <div className="relative mt-2">
          <Phone
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--color-text-muted)" }}
          />
          <Input
            id="demo-phone"
            className="h-10 pl-9"
            placeholder={PHONE_PLACEHOLDER}
            maxLength={PHONE_MAX_LENGTH}
            value={phone}
            onChange={(e) => setPhone(formatPhoneOnChange(e.target.value))}
          />
        </div>
        <DemoNote>
          Grouped 4-4-3 as you type; validated with{" "}
          <span className="font-mono">zPhone</span> and stored as{" "}
          <span className="font-mono">09XX XXXX XXX</span>.
        </DemoNote>
      </Demo>

      <Demo name="Select" source="@/components/ui/select">
        <Label htmlFor="demo-select">Assigned role</Label>
        <Select defaultValue="manager">
          <SelectTrigger id="demo-select" className="h-10 w-full mt-2">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="manager">Branch Manager</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="auditor">Auditor</SelectItem>
          </SelectContent>
        </Select>
        <DemoNote>
          Radix Select — no type-ahead. For long lists use SearchableSelect
          (next card).
        </DemoNote>
      </Demo>

      <Demo name="SearchableSelect" source="@/components/SearchableSelect">
        <Label>Short list — search box hides itself</Label>
        <div className="mt-2">
          <SearchableSelect
            value={role}
            onValueChange={setRole}
            placeholder="Select role"
            options={ROLE_OPTIONS}
          />
        </div>

        <Label className="mt-4">Long list — filter appears at 12+ options</Label>
        <div className="mt-2">
          <SearchableSelect
            value={member}
            onValueChange={setMember}
            placeholder="Select member"
            searchPlaceholder="Search members…"
            options={MEMBER_OPTIONS}
          />
        </div>

        <div className="mt-4">
          <Label>Drop-in — the same children a &lt;Select&gt; had</Label>
          <div className="mt-2">
            <SearchableSelect value={branch} onValueChange={setBranch}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BR-001">Main Branch</SelectItem>
                <SelectItem value="BR-002">North Branch</SelectItem>
                <SelectItem value="BR-003">South Branch</SelectItem>
              </SelectContent>
            </SearchableSelect>
          </div>
        </div>

        <DemoNote>
          Converting a call site is a rename: it walks the SelectItems out of the
          children and keeps the trigger&apos;s className.
        </DemoNote>
      </Demo>

      <Demo name="DatePicker" source="@/components/DatePicker">
        <Label htmlFor="demo-date">Start date</Label>
        <div className="mt-2">
          <DatePicker
            id="demo-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <Label className="mt-4">With time — showTime</Label>
        <div className="mt-2">
          <DatePicker
            showTime
            value={appointment}
            onChange={(e) => setAppointment(e.target.value)}
          />
        </div>

        <Label className="mt-4">Bounded — min / max</Label>
        <div className="mt-2">
          <DatePicker
            value={bounded}
            min={MIN_DATE}
            max={MAX_DATE}
            placeholder={`${MIN_DATE} → ${MAX_DATE}`}
            onChange={(e) => setBounded(e.target.value)}
          />
        </div>

        <DemoNote>
          Emits the same strings as{" "}
          <span className="font-mono">&lt;input type=&quot;date&quot;&gt;</span>{" "}
          (<span className="font-mono">YYYY-MM-DD</span>, or{" "}
          <span className="font-mono">YYYY-MM-DDTHH:mm</span> with time) through
          a synthetic event, so it drops into a form field as{" "}
          <span className="font-mono">{"{...field}"}</span>. Type into it, or
          click the month/year to jump. Value:{" "}
          <span className="font-mono">{startDate || "—"}</span>
        </DemoNote>
      </Demo>

      <Demo name="Textarea" source="@/components/ui/textarea">
        <Label htmlFor="demo-textarea">Description</Label>
        <Textarea
          id="demo-textarea"
          className="mt-2"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          placeholder="What can this role do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end mt-1.5">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
      </Demo>

      <Demo name="Checkbox" source="@/components/ui/checkbox">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="demo-terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(!!v)}
            />
            <Label htmlFor="demo-terms">Send an invitation email</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="demo-indeterminate" checked="indeterminate" />
            <Label htmlFor="demo-indeterminate">
              Indeterminate (select-all header)
            </Label>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="demo-checkbox-disabled" disabled />
            <Label htmlFor="demo-checkbox-disabled">Disabled</Label>
          </div>
        </div>
      </Demo>

      <Demo name="StatusToggle" source="@/components/StatusToggle">
        <SectionLabel>Access status</SectionLabel>
        <StatusToggle value={status} onChange={setStatus} />
        <div className="mt-4">
          <SectionLabel>Custom options</SectionLabel>
          <StatusToggle
            value={visibility}
            onChange={setVisibility}
            options={[
              { v: "Public", dot: "var(--color-success)" },
              { v: "Internal", dot: "var(--color-warning)" },
              { v: "Private", dot: "var(--color-text-muted)" },
            ]}
          />
        </div>
        <DemoNote>
          Use this instead of a Select for on/off choices. SectionLabel (above
          each) groups fields in a drawer.
        </DemoNote>
      </Demo>

      <Demo
        wide
        name="Form drawer — react-hook-form + zod inside a Sheet"
        source="@/components/ui/sheet · ui-form-design.md"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setDrawerOpen(true)}>
            <SquarePen />
            Open the form drawer
          </Button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            The canonical create/edit pattern: the form file owns its Sheet,
            props are exactly{" "}
            <span className="font-mono">
              {"{ open, onClose, onSuccess, entity? }"}
            </span>
            , validation is zod, and the footer's primary button is the inverted
            default variant. Type something then press Escape — the discard
            guard (<span className="font-mono">useDiscardGuard</span>) asks
            before the edits are lost.
          </span>
        </div>
        <DemoFormDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => setDrawerOpen(false)}
        />
      </Demo>
    </Section>
  );
};

export default FormControlsSection;
