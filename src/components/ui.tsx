import type { Icon } from "@/components/icons";

// Shared, non-interactive building blocks. Every screen uses these so the
// whole app reads as one product. The look is Nocturne (see globals.css):
// main buttons are a violet outline with a soft glow, never a solid fill.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border border-accent text-accent-400 shadow-glow hover:bg-accent/12 active:bg-accent/22",
  secondary: "border border-line text-ink hover:bg-ink/7 active:bg-ink/14",
  ghost: "text-accent-400 hover:bg-accent/10 active:bg-accent/18",
  danger: "text-danger-text hover:bg-danger-text/10 active:bg-danger-text/16",
};

export function buttonClass(variant: ButtonVariant = "primary", options: { full?: boolean; size?: "md" | "sm" } = {}) {
  const size = options.size === "sm" ? "h-9 px-3" : "h-11 px-4";
  // "full" buttons fill the width on phones and shrink to fit on bigger screens.
  return `${buttonBase} ${buttonVariants[variant]} ${size} ${options.full ? "w-full sm:w-auto" : ""}`;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span translate="no" className={`text-lg font-medium tracking-tight text-accent-400 ${className}`}>
      Bookbell
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-surface shadow-card ${className}`}>{children}</div>;
}

export function CardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-[18px] sm:p-6">
      <h2 className="text-base font-medium text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-neutral-400">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** A page title: an optional small grey line above (like a date), the big title, and a short description. */
export function PageHeader({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Something on the right of the title, like the account button. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[13px] text-neutral-400 tabular">{eyebrow}</p> : null}
        <h1 className="mt-0.5 text-[28px] leading-tight font-medium tracking-tight text-balance wrap-anywhere text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-sm text-neutral-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "brand";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-800 text-neutral-200",
  success: "bg-success-soft text-success-ink",
  warning: "bg-amber-50 text-amber-900",
  brand: "bg-accent-800 text-accent-100",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${badgeTones[tone]}`}>{children}</span>
  );
}

/** Placeholder shapes shown while a page loads. */
export function PageSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="h-4 w-32 rounded-md bg-surface" />
      <div className="mt-2 h-8 w-48 rounded-md bg-surface" />
      <div className="mt-6 h-40 rounded-lg bg-surface" />
      <div className="mt-4 h-24 rounded-lg bg-surface" />
    </div>
  );
}

export function EmptyState({
  icon: IconShape,
  title,
  children,
  as: Title = "p",
}: {
  icon: Icon;
  title: string;
  children: React.ReactNode;
  /** Use "h1" when the empty state is the whole page, so screen readers announce it as the title. */
  as?: "p" | "h1" | "h2";
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-neutral-800 text-neutral-300">
        <IconShape aria-hidden className="size-5" />
      </span>
      <Title className="font-medium text-ink">{title}</Title>
      <p className="mt-1 max-w-sm text-sm text-neutral-400">{children}</p>
    </div>
  );
}
