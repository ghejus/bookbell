"use client";

import { useTransition } from "react";
import { LANG_NAMES, LANGS } from "@/lib/i18n/config";
import { setLanguage } from "@/lib/i18n/actions";
import { useLang, useT } from "@/lib/i18n/client";

/**
 * "EN · RO": two small buttons. The choice is saved in a cookie, then the page
 * reloads, so every part (and the browser's memory of other pages) is in the
 * new language.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const current = useLang();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t.common.language} className={`inline-flex items-center gap-0.5 text-[13px] ${className}`}>
      {LANGS.map((l) => {
        const on = l === current;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-label={LANG_NAMES[l]}
            aria-pressed={on}
            disabled={pending}
            onClick={() => {
              if (on) return;
              start(async () => {
                await setLanguage(l);
                window.location.reload();
              });
            }}
            className={`h-8 min-w-9 rounded-md px-2 font-medium uppercase transition-colors duration-150 ${
              on ? "bg-accent-900 text-accent-300" : "text-neutral-400 hover:bg-ink/7 hover:text-ink"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
