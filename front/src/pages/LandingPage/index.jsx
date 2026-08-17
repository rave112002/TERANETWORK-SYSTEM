import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ActionsSection from "./components/ActionsSection";
import ChartsSection from "./components/ChartsSection";
import DataDisplaySection from "./components/DataDisplaySection";
import FeedbackSection from "./components/FeedbackSection";
import FormControlsSection from "./components/FormControlsSection";
import FoundationsSection from "./components/FoundationsSection";
import LayoutSection from "./components/LayoutSection";
import OverlaysSection from "./components/OverlaysSection";

const SECTIONS = [
  { id: "foundations", label: "Foundations" },
  { id: "actions", label: "Actions" },
  { id: "forms", label: "Form controls" },
  { id: "data", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "overlays", label: "Overlays" },
  { id: "charts", label: "Charts" },
  { id: "layout", label: "Layout" },
];

/** Height of the sticky nav — sections become "current" once they clear it. */
const NAV_OFFSET = 72;

/**
 * Highlight whichever section the reader is on. A scroll listener (rAF-throttled)
 * rather than an IntersectionObserver, because it also has to resolve the two
 * cases an observer can't: nothing intersecting yet at the top of the page, and
 * a short final section that never reaches the middle of the viewport.
 */
const useActiveSection = () => {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActiveId(SECTIONS[SECTIONS.length - 1].id);
        return;
      }
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET + 8) {
          current = s.id;
        }
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return activeId;
};

/**
 * Public landing page — doubles as the component gallery for this template.
 * Every shared component and shadcn primitive in `src/components/` is previewed
 * below in both themes, so the design system can be checked at a glance.
 */
const LandingPage = () => {
  const navigate = useNavigate();
  const activeId = useActiveSection();

  return (
    <div className="min-h-screen" style={{ background: "var(--color-canvas)" }}>
      {/* Hero */}
      <header className="px-6 pt-14 pb-10">
        <div className="mx-auto max-w-6xl text-center">
          <span
            className="inline-flex items-center gap-2 mb-5"
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface)",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            <ShieldCheck
              className="w-3.5 h-3.5"
              style={{ color: "var(--color-secondary-color)" }}
            />
            Multi-tenant admin template
          </span>

          <h1
            className="m-0 font-semibold leading-tight"
            style={{
              fontSize: 42,
              letterSpacing: "-1px",
              color: "var(--color-text-dark)",
            }}
          >
            {import.meta.env.VITE_APP_NAME}
          </h1>
          <p
            className="m-0 mt-3 mx-auto max-w-xl"
            style={{ fontSize: 15, color: "var(--color-text-secondary)" }}
          >
            Your modern web application — and, below, a live preview of every
            component the template ships with.
          </p>

          <div className="flex items-center justify-center gap-2.5 mt-8">
            <Button size="lg" onClick={() => navigate("/admin")}>
              Admin Login
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#foundations">
                Browse components
                <ArrowRight />
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Section nav */}
      <nav
        className="sticky top-0 z-20 px-6 py-2.5"
        style={{
          background:
            "color-mix(in srgb, var(--color-canvas) 88%, transparent)",
          borderTop: "1px solid var(--color-line)",
          borderBottom: "1px solid var(--color-line)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto max-w-6xl flex items-center gap-1.5 overflow-x-auto">
          {SECTIONS.map((s) => {
            const isActive = s.id === activeId;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn("nav-item shrink-0", isActive && "is-active")}
                style={{ fontSize: 13, gap: 8 }}
              >
                {/* Accent tick — the same marker the sidebar puts on its active row */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 3,
                    height: 13,
                    borderRadius: 2,
                    background: isActive
                      ? "var(--color-secondary-color)"
                      : "transparent",
                  }}
                />
                {s.label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Gallery */}
      <main className="px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-12">
          <FoundationsSection />
          <ActionsSection />
          <FormControlsSection />
          <DataDisplaySection />
          <FeedbackSection />
          <OverlaysSection />
          <ChartsSection />
          <LayoutSection />
        </div>
      </main>

      <footer
        className="px-6 py-8"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <div
          className="mx-auto max-w-6xl flex items-center justify-between gap-4 flex-wrap"
          style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
        >
          <span>
            shadcn/ui + Tailwind v4 · tokens in{" "}
            <span className="font-mono">src/index.css</span>
          </span>
          <span>
            Conventions:{" "}
            <span className="font-mono">.claude/skills/frontend-conventions</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
