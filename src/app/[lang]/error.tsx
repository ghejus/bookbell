"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass, Card, Logo } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

// Shown when a page breaks, in the visitor's language (instead of Next.js's
// own English "Application error" message).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo className="text-xl" />
      </Link>
      <main className="w-full max-w-sm">
        <Card>
          <div className="space-y-2 px-6 pt-6">
            <h1 className="text-lg font-medium">{t.notFound.brokeTitle}</h1>
            <p className="text-sm text-neutral-400">{t.notFound.brokeText}</p>
          </div>
          <div className="flex flex-col gap-2 p-6">
            <button type="button" onClick={reset} className={`${buttonClass("primary")} w-full`}>
              {t.notFound.tryAgain}
            </button>
            <Link href="/" className={`${buttonClass("secondary")} w-full`}>
              {t.notFound.home}
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
