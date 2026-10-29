"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";
import { createContext, use, useState } from "react";

// Shared state for the booking page: once a booking is made, the steps above
// the confirmation step aside, so the customer only sees their receipt.

type Flow = { booked: boolean; setBooked: (booked: boolean) => void };
const FlowContext = createContext<Flow>({ booked: false, setBooked: () => {} });

export function BookingFlow({ children }: { children: React.ReactNode }) {
  const [booked, setBooked] = useState(false);
  return <FlowContext value={{ booked, setBooked }}>{children}</FlowContext>;
}

export function useBookingFlow() {
  return use(FlowContext);
}

/** Hides its content after a booking is made. */
export function HideWhenBooked({ children }: { children: React.ReactNode }) {
  const { booked } = useBookingFlow();
  return booked ? null : <>{children}</>;
}

/** Inside a link: shows a spinner instead of its children while the next page loads (same slot, no jump). */
export function PendingSwap({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" /> : <>{children}</>;
}

/** A small spinner inside a link while the next page loads, so a tap never looks ignored. */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <LoaderCircle aria-hidden className={`size-4 shrink-0 motion-safe:animate-spin ${className}`} />
  ) : null;
}
