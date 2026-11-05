"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/app/(auth)/actions";
import { SignOutIcon, StorefrontIcon, UserIcon } from "@/components/icons";
import { Sheet, SheetHeader } from "@/components/sheet";

export type AccountInfo = {
  /** The letter in the round button. */
  initial: string;
  name: string;
  /** A short line under the name. */
  sub: string;
  isDemo: boolean;
};

/**
 * The round letter button at the top of each screen (or a wider row in the
 * computer sidebar). It opens the account sheet: who you are, "Use Bookbell
 * as Shop owner / Customer", and Log out.
 */
export function AccountButton({
  account,
  mode,
  variant = "avatar",
  className = "",
}: {
  account: AccountInfo;
  mode: "owner" | "customer";
  variant?: "avatar" | "row";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const owner = mode === "owner";

  return (
    <>
      {variant === "avatar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Account and view"
          className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-accent-800 bg-accent-900 text-sm font-medium text-accent-300 transition-colors duration-150 hover:bg-accent-800 ${className}`}
        >
          {account.initial}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-ink/7 ${className}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent-800 bg-accent-900 text-sm font-medium text-accent-300">
            {account.initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{account.name}</span>
            <span className="block text-xs text-neutral-400">{owner ? "Shop owner" : "Customer"}</span>
          </span>
        </button>
      )}

      {open ? (
        <Sheet label="Account" onClose={() => setOpen(false)}>
          <SheetHeader
            onClose={() => setOpen(false)}
            title={
              <span className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent-800 bg-accent-900 text-base font-medium text-accent-300">
                  {account.initial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{account.name}</span>
                  <span className="block text-[13px] font-normal text-neutral-400">{account.sub}</span>
                </span>
              </span>
            }
          />
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Use Bookbell as</p>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
                {(
                  [
                    { key: "owner", label: "Shop owner", href: "/dashboard", icon: StorefrontIcon },
                    { key: "customer", label: "Customer", href: "/my", icon: UserIcon },
                  ] as const
                ).map((o) => {
                  const on = o.key === mode;
                  return (
                    <Link
                      key={o.key}
                      href={o.href}
                      onClick={() => setOpen(false)}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-14 items-center justify-center gap-2 text-sm font-medium transition-colors duration-150 ${
                        on ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"
                      }`}
                    >
                      <o.icon aria-hidden weight={on ? "fill" : "regular"} className="size-[18px]" />
                      {o.label}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-neutral-400">
                {owner ? "Run your shop: bookings, calendar and setup." : "Book at a shop and manage your own bookings."}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="-ml-3 flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-300 transition-colors duration-150 hover:bg-ink/7"
              >
                <SignOutIcon aria-hidden className="size-[17px]" />
                {account.isDemo ? "Leave the demo" : "Log out"}
              </button>
            </form>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
