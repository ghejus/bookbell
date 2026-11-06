"use client";

import { useT } from "@/lib/i18n/client";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * The shop's "about" text. Long texts show four lines and a "Show more" button,
 * so the booking steps stay near the top on phones. Line breaks the owner typed are kept.
 */
export function AboutText({ text }: { text: string }) {
  const t = useT();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  // Only offer the button when the text really is cut off (checked again if the window resizes).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-2 max-w-prose">
      <p ref={ref} id="shop-about" className={`wrap-anywhere whitespace-pre-line text-gray-700 ${open ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {long || open ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="shop-about"
          className="mt-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          {open ? t.shop.showLess : t.shop.showMore}
        </button>
      ) : null}
    </div>
  );
}
