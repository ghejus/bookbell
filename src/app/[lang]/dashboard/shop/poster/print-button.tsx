"use client";

import { PrinterIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { useOwnerT } from "@/lib/i18n/client";

export function PrintButton() {
  const o = useOwnerT();
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", { size: "sm" })}>
      <PrinterIcon aria-hidden className="size-4" />
      {o("Print")}
    </button>
  );
}
