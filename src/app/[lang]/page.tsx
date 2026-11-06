import { CalendarCheckIcon, ChatCircleTextIcon, ShieldCheckIcon } from "@/components/icons";
import Link from "next/link";
import { DemoButton } from "@/components/demo-button";
import { buttonClass, Logo } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { hasSupabaseEnv } from "@/lib/env";
import { getT } from "@/lib/i18n/server";

// A simple holding page. The full landing page comes with the public booking page.

const icons = [CalendarCheckIcon, ChatCircleTextIcon, ShieldCheckIcon];

export default async function Home() {
  const t = await getT();
  const points = t.home.points.map((text, i) => ({ icon: icons[i], text }));
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {hasSupabaseEnv ? (
            <Link href="/login" className={buttonClass("ghost", { size: "sm" })}>
              {t.common.logIn}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight text-gray-900 text-balance sm:text-5xl">
          {t.home.title}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-gray-600">
          {t.home.lead}
        </p>

        {hasSupabaseEnv ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClass("primary", { full: true })}>
              {t.home.setUp}
            </Link>
            <DemoButton />
          </div>
        ) : (
          <div role="status" className="mt-8 max-w-xl rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
            <p className="font-medium">The database isn’t connected yet.</p>
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
          {t.home.notSure}
        </p>
      </main>
    </div>
  );
}
