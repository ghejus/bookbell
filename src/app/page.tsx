import { CalendarCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DemoButton } from "@/components/demo-button";
import { buttonClass, Logo } from "@/components/ui";
import { hasSupabaseEnv } from "@/lib/env";

// A simple holding page. The full landing page comes with the public booking page.

const points = [
  { icon: CalendarCheck, text: "Customers pick a free time themselves. Two people can never get the same slot." },
  { icon: MessageSquareText, text: "An AI helper answers their questions, using only the notes you wrote." },
  { icon: ShieldCheck, text: "Free, no app to install. Your customers don’t need an account." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        {hasSupabaseEnv ? (
          <Link href="/login" className={buttonClass("ghost", { size: "sm" })}>
            Log in
          </Link>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 text-balance sm:text-5xl">
          Online booking for your shop, with a helper that answers questions.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-gray-600">
          For barbers, salons, dentists and any shop that works by appointment. Add your services and hours, share one
          link, and let customers book themselves.
        </p>

        {hasSupabaseEnv ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClass("primary", { full: true })}>
              Set up my shop
            </Link>
            <DemoButton />
          </div>
        ) : (
          <div role="status" className="mt-8 max-w-xl rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            <p className="font-semibold">The database isn’t connected yet.</p>
            <p className="mt-1">
              Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, add your
              Supabase URL and publishable key, then restart <code className="font-mono">npm run dev</code>.
            </p>
          </div>
        )}

        <ul className="mt-16 grid max-w-3xl gap-6 border-t border-gray-200 pt-10 sm:grid-cols-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="text-sm text-gray-700">
              <Icon aria-hidden className="mb-3 size-5 text-brand-700" />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-sm text-gray-600">
          Not sure yet? “Try a demo shop” opens your own sample shop with services, hours and bookings filled in. Nobody else sees your changes, and no email is needed.
        </p>
      </main>
    </div>
  );
}
