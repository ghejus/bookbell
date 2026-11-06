"use client";

import { PrinterIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", { size: "sm" })}>
      <PrinterIcon aria-hidden className="size-4" />
      Print
    </button>
  );
}
