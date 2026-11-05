"use client";

import { CheckIcon, CopyIcon } from "@/components/icons";
import { useState } from "react";
import { buttonClass } from "@/components/ui";

/** Shows a full web address with a button that copies it. Says "Copied." for a moment. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: select the text so the owner can copy it by hand.
      const field = document.getElementById("booking-link") as HTMLInputElement | null;
      field?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex gap-2">
      <label htmlFor="booking-link" className="sr-only">
        Your booking link
      </label>
      <input
        id="booking-link"
        readOnly
        value={url.replace(/^https?:\/\//, "")}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <button type="button" onClick={copy} className={`${buttonClass("secondary")} shrink-0 whitespace-nowrap ${copied ? "text-success-ink" : ""}`}>
        {copied ? <CheckIcon aria-hidden className="size-4" /> : <CopyIcon aria-hidden className="size-4" />}
        {copied ? "Copied." : "Copy link"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied." : ""}
      </span>
    </div>
  );
}
