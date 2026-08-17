import { useEffect, useState } from "react";
import {
  Building2,
  LogOut,
  Settings,
  Shield,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DescriptionList from "@/components/DescriptionList";
import { Demo, DemoNote, DemoRow, Section } from "./Showcase";

const OverlaysSection = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [digest, setDigest] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Section
      id="overlays"
      title="Overlays"
      description="The only layers that carry a shadow — Radix handles the focus trap, portal and animation."
    >
      <Demo name="Dialog" source="@/components/ui/dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">View member details</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-160">
            <DialogHeader>
              <DialogTitle>Maria Santos</DialogTitle>
              <DialogDescription>
                Read-only detail view — Dialog plus DescriptionList.
              </DialogDescription>
            </DialogHeader>
            <DescriptionList
              items={[
                { label: "Email", value: "maria@acme.test" },
                { label: "Phone", value: "0912 3456 789" },
                { label: "Role", value: "Administrator" },
                { label: "Company", value: "Acme Corporation" },
              ]}
            />
            <DialogFooter>
              <Button variant="outline">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DemoNote>
          Short forms and read-only views use a Dialog; create/edit forms use a
          Sheet.
        </DemoNote>
      </Demo>

      <Demo name="Sheet" source="@/components/ui/sheet">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="right" className="sm:max-w-140">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>
                The bare Sheet primitive. Form drawers wrap it with the
                react-hook-form pattern instead.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Apply</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Demo>

      <Demo name="AlertDialog" source="@/components/ui/alert-dialog">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 />
              Delete company
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete company</AlertDialogTitle>
              <AlertDialogDescription>
                Acme Corporation and everything scoped to it will be marked as
                deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => toast.error("Deleted")}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <DemoNote>
          Prefer the imperative{" "}
          <span className="font-mono">await confirm({"{…}"})</span> helper — it
          drives this same primitive from a single host.
        </DemoNote>
      </Demo>

      <Demo name="DropdownMenu" source="@/components/ui/dropdown-menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Avatar size="sm">
                <AvatarFallback>MS</AvatarFallback>
              </Avatar>
              Maria Santos
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User />
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={notify}
              onCheckedChange={setNotify}
            >
              Email notifications
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={digest}
              onCheckedChange={setDigest}
            >
              Weekly digest
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Shield />
                Switch role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Administrator</DropdownMenuItem>
                <DropdownMenuItem>Branch Manager</DropdownMenuItem>
                <DropdownMenuItem>Staff</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Demo>

      <Demo name="Popover · HoverCard · Tooltip" source="@/components/ui/popover">
        <DemoRow>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <PopoverHeader>
                <PopoverTitle>Branch scope</PopoverTitle>
                <PopoverDescription>
                  Admin queries are scoped to your companyId and branchId.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="outline">Hover card</Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback>AC</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p
                    className="m-0 font-semibold"
                    style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
                  >
                    Acme Corporation
                  </p>
                  <p
                    className="m-0 mt-0.5"
                    style={{
                      fontSize: 12.5,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    38 users across 4 branches.
                  </p>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Wrapped once by TooltipProvider in App</TooltipContent>
          </Tooltip>
        </DemoRow>
      </Demo>

      <Demo name="Command palette" source="@/components/ui/command">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setPaletteOpen(true)}>
            Open palette
          </Button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            or press{" "}
            <span
              className="font-mono"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              ⌘K
            </span>
          </span>
        </div>
        <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => setPaletteOpen(false)}>
                <Users />
                Users
                <CommandShortcut>⌘U</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => setPaletteOpen(false)}>
                <Shield />
                Roles
              </CommandItem>
              <CommandItem onSelect={() => setPaletteOpen(false)}>
                <Building2 />
                Companies
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Account">
              <CommandItem onSelect={() => setPaletteOpen(false)}>
                <Settings />
                Settings
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
        <DemoNote>
          cmdk + Dialog — also the base for a searchable combobox (popover +
          command).
        </DemoNote>
      </Demo>
    </Section>
  );
};

export default OverlaysSection;
