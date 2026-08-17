import { KeyRound, MailCheck } from "lucide-react";
import AuthHeading from "@/components/AuthHeading";
import DescriptionList from "@/components/DescriptionList";
import { Demo, DemoNote, Section } from "./Showcase";

const STRUCTURAL = [
  {
    label: "BasicLayout",
    value: "Portal shell — sidebar + topbar + routed content area.",
  },
  {
    label: "Sidebar",
    value:
      "Navigation built from the route file's navigations array, filtered by permission.",
  },
  {
    label: "AuthLayout",
    value: "Centered card the login / forgot-password screens sit in.",
  },
  {
    label: "ProtectedRoute",
    value:
      "Gates a page on module / submodule / accessLevel — the same permission the API enforces.",
  },
  {
    label: "ErrorBoundary",
    value: "Catches render errors below it and shows a recoverable panel.",
  },
  {
    label: "ComponentLoader / PageLoader",
    value: "Suspense fallbacks for lazy routes (LoadingFallback.jsx).",
  },
  {
    label: "NotFound",
    value: "The 404 panel rendered inside a portal's content area.",
  },
  {
    label: "ConfirmDialog",
    value: "The single mounted host that every confirm() call drives.",
  },
];

const LayoutSection = () => (
  <Section
    id="layout"
    title="Layout & routing"
    description="The pieces that wrap pages rather than sit inside them."
  >
    <Demo name="AuthHeading" source="@/components/AuthHeading">
      <AuthHeading
        icon={KeyRound}
        title="Welcome back"
        subtitle="Sign in to continue to the admin portal."
      />
      <div
        className="pt-4"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <AuthHeading
          centered
          icon={MailCheck}
          title="Check your email"
          subtitle="We sent a reset link to maria@acme.test."
        />
      </div>
      <DemoNote>
        The default variant heads a form; <span className="font-mono">centered</span>{" "}
        is the confirmation-screen variant.
      </DemoNote>
    </Demo>

    <Demo name="Structural components" source="src/components/">
      <DescriptionList items={STRUCTURAL} />
      <DemoNote>
        These have no standalone preview — they only make sense wrapping a
        route.
      </DemoNote>
    </Demo>
  </Section>
);

export default LayoutSection;
