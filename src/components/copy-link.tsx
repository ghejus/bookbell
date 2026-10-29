"use client";

import { Check, Copy } from "lucide-react";
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
    <div className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="booking-link" className="sr-only">
        Your booking link
      </label>
      <input
        id="booking-link"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-900 shadow-sm sm:flex-1"
      />
      <button type="button" onClick={copy} className={buttonClass("secondary", { full: true })}>
        {copied ? <Check aria-hidden className="size-4 text-green-600" /> : <Copy aria-hidden className="size-4" />}
        {copied ? "Copied." : "Copy link"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied." : ""}
      </span>
    </div>
  );
}
