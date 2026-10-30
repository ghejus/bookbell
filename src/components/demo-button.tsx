"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { startDemo } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * "Try a demo shop": signs in with a no-email account (from the visitor's own
 * browser, so Supabase's per-visitor limits apply) and opens a sample shop.
 */
export function DemoButton({ variant = "secondary", full = true }: { variant?: "primary" | "secondary"; full?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          setError(
            signInError.status === 429
              ? "Too many demos from this network right now. Please try again in a while."
              : "The demo isn’t available right now. Please try again later.",
          );
          return;
        }
      }
      const result = await startDemo();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={full ? "w-full sm:w-auto" : undefined}>
      <button type="button" onClick={start} disabled={pending} aria-busy={pending} className={`${buttonClass(variant, { full })} ${full ? "w-full" : ""}`}>
        {pending ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
        {pending ? "Making your demo shop…" : "Try a demo shop"}
      </button>
      {error ? (
        <div className="mt-3">
          <FormMessage state={{ error }} />
        </div>
      ) : null}
    </div>
  );
}
