"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, TextArea } from "@/components/form";
import { StarIcon } from "@/components/icons";
import { useActionForm } from "@/components/use-action-form";
import type { ActionState } from "@/lib/action-state";
import { REVIEW_MAX, STAR_WORDS, starsLabel } from "@/lib/reviews";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * "How was it?": five big stars and an optional few words.
 * The stars are real radio buttons, so arrow keys and screen readers work,
 * and the form still sends before JavaScript has loaded.
 */
export function ReviewForm({
  action,
  hidden,
  initial,
  submitLabel = "Post review",
}: {
  action: Action;
  /** Which booking: the secret link token, or the booking id. */
  hidden: Record<string, string>;
  initial?: { stars: number | null; body: string | null };
  submitLabel?: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [stars, setStars] = useState(initial?.stars ?? 0);
  // While a finger or mouse hovers a star, show what tapping it would give.
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  return (
    <form {...formProps} className="space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
        <div className="flex items-center gap-3">
          <div className="-ml-1.5 flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="relative cursor-pointer rounded-lg p-1.5 has-focus-visible:ring-2 has-focus-visible:ring-accent" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="stars"
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                  required
                  className="sr-only"
                />
                <span className="sr-only">{starsLabel(n)}</span>
                <StarIcon
                  aria-hidden
                  weight="fill"
                  className={`size-8 transition-colors duration-100 ${n <= shown ? "text-accent-400" : "text-neutral-700"}`}
                />
              </label>
            ))}
          </div>
          <span aria-hidden className="min-w-0 text-sm text-neutral-400">
            {shown ? STAR_WORDS[shown - 1] : ""}
          </span>
        </div>
      </fieldset>
      <TextArea
        label="A few words"
        name="body"
        maxLength={REVIEW_MAX}
        defaultValue={state?.values?.body ?? initial?.body ?? ""}
        placeholder="What did you like? What could be better?"
        hint="Shown on the shop’s page with your first name and the first letter of your last name."
      />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
