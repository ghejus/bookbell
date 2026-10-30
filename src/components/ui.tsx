import type { LucideIcon } from "lucide-react";

// Shared, non-interactive building blocks. Every screen uses these so the
// whole app reads as one product.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-800",
  secondary: "border border-gray-300 bg-white text-gray-900 shadow-sm hover:bg-gray-50 active:bg-gray-100",
  ghost: "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
  danger: "text-red-700 hover:bg-red-50 active:bg-red-100",
};

export function buttonClass(variant: ButtonVariant = "primary", options: { full?: boolean; size?: "md" | "sm" } = {}) {
  const size = options.size === "sm" ? "h-9 px-3" : "h-11 px-4";
  // "full" buttons fill the width on phones and shrink to fit on bigger screens.
  return `${buttonBase} ${buttonVariants[variant]} ${size} ${options.full ? "w-full sm:w-auto" : ""}`;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span translate="no" className={`text-lg font-semibold tracking-tight text-brand-700 ${className}`}>
      Bookbell
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white shadow-card ${className}`}>{children}</div>;
}

export function CardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function PageHeader({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 text-balance">{title}</h1>
      {description ? <p className="mt-1 max-w-prose text-sm text-gray-600">{description}</p> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "brand";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700 ring-gray-200",
  success: "bg-green-50 text-green-800 ring-green-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

/** Grey placeholder shapes shown while a dashboard page loads. */
export function PageSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="h-7 w-48 rounded-md bg-gray-200" />
      <div className="mt-2 h-4 w-72 max-w-full rounded-md bg-gray-200" />
      <div className="mt-6 h-40 rounded-xl bg-gray-200/70" />
      <div className="mt-4 h-24 rounded-xl bg-gray-200/70" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  as: Title = "p",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /** Use "h1" when the empty state is the whole page, so screen readers announce it as the title. */
  as?: "p" | "h1" | "h2";
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-gray-100 text-gray-600">
        <Icon aria-hidden className="size-5" />
      </span>
      <Title className="font-semibold text-gray-900">{title}</Title>
      <p className="mt-1 max-w-sm text-sm text-gray-600">{children}</p>
    </div>
  );
}
