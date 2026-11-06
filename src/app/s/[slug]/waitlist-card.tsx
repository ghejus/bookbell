"use client";

import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { BellRingingIcon, CheckCircleIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { useActionForm } from "@/components/use-action-form";
import { joinWaitlist, leaveWaitlist } from "./actions";

type Who =
  | { kind: "guest"; loginHref: string; signupHref: string }
  | { kind: "demo"; signupHref: string }
  | { kind: "customer" }
  | { kind: "waiting"; id: string };

/**
 * Shown on a full day: "Tell me if a time opens". People must be logged in,
 * because the free time shows up in their My bookings.
 */
export function WaitlistCard({
  serviceId,
  staffId,
  day,
  dayLabel,
  who,
}: {
  serviceId: string;
  staffId?: string;
  day: string;
  dayLabel: string;
  who: Who;
}) {
  const { state, pending, formProps } = useActionForm(joinWaitlist);

  if (who.kind === "waiting") {
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-success-ink" />
          <div className="space-y-1">
            <p className="font-medium">You’re on the waitlist for {dayLabel}</p>
            <p className="text-sm text-neutral-400">If a time opens, it shows in My bookings with a “Book it” button. First come, first served.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/my" className={buttonClass("secondary", { size: "sm" })}>
            My bookings
          </Link>
          <form action={leaveWaitlist}>
            <input type="hidden" name="id" value={who.id} />
            <SubmitButton variant="ghost" size="sm" pendingText="Leaving…">
              Leave the waitlist
            </SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <BellRingingIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-400" />
        <div className="space-y-1">
          <p className="font-medium">{dayLabel} is fully booked</p>
          <p className="text-sm text-neutral-400">
            Join the waitlist: if someone cancels, the free time shows up in your My bookings, and the shop can see you’re waiting.
          </p>
        </div>
      </div>

      {who.kind === "guest" ? (
        <div className="flex flex-wrap gap-2">
          <Link href={who.loginHref} className={buttonClass("primary", { size: "sm" })}>
            Log in to join
          </Link>
          <Link href={who.signupHref} className={buttonClass("secondary", { size: "sm" })}>
            Make a free account
          </Link>
        </div>
      ) : who.kind === "demo" ? (
        <p className="rounded-lg bg-raised px-4 py-3 text-sm text-neutral-300">
          You’re using a demo account, which can’t join a waitlist.{" "}
          <Link href={who.signupHref} className="font-medium text-accent-400 hover:underline">
            Make a free account
          </Link>{" "}
          to try it.
        </p>
      ) : (
        <form {...formProps} className="space-y-3">
          <input type="hidden" name="service_id" value={serviceId} />
          <input type="hidden" name="staff_id" value={staffId ?? ""} />
          <input type="hidden" name="day" value={day} />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            defaultValue={state?.values?.phone ?? ""}
            hint="So the shop can call you if a time opens."
          />
          <FormMessage state={state} />
          <div className="[&>button]:w-full">
            <SubmitButton pending={pending} pendingText="Joining…">
              Join the waitlist
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
