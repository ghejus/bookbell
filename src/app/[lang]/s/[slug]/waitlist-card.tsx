"use client";

import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { BellRingingIcon, CheckCircleIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { useActionForm } from "@/components/use-action-form";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();

  if (who.kind === "waiting") {
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircleIcon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-success-ink" />
          <div className="space-y-1">
            <p className="font-medium">{t.waitlist.onIt(dayLabel)}</p>
            <p className="text-sm text-neutral-400">{t.waitlist.onItText}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/my" className={buttonClass("secondary", { size: "sm" })}>
            {t.common.myBookings}
          </Link>
          <form action={leaveWaitlist}>
            <input type="hidden" name="id" value={who.id} />
            <SubmitButton variant="ghost" size="sm" pendingText={t.waitlist.leaving}>
              {t.waitlist.leave}
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
          <p className="font-medium">{t.waitlist.fullTitle(dayLabel)}</p>
          <p className="text-sm text-neutral-400">
            {t.waitlist.fullText}
          </p>
        </div>
      </div>

      {who.kind === "guest" ? (
        <div className="flex flex-wrap gap-2">
          <Link href={who.loginHref} className={buttonClass("primary", { size: "sm" })}>
            {t.waitlist.logInToJoin}
          </Link>
          <Link href={who.signupHref} className={buttonClass("secondary", { size: "sm" })}>
            {t.common.makeFreeAccount}
          </Link>
        </div>
      ) : who.kind === "demo" ? (
        <p className="rounded-lg bg-raised px-4 py-3 text-sm text-neutral-300">
          {t.waitlist.demo}{" "}
          <Link href={who.signupHref} className="font-medium text-accent-400 hover:underline">
            {t.common.makeFreeAccount}
          </Link>{" "}
          {t.waitlist.demoTry}
        </p>
      ) : (
        <form {...formProps} className="space-y-3">
          <input type="hidden" name="service_id" value={serviceId} />
          <input type="hidden" name="staff_id" value={staffId ?? ""} />
          <input type="hidden" name="day" value={day} />
          <Field
            label={t.common.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            defaultValue={state?.values?.phone ?? ""}
            hint={t.waitlist.phoneHint}
          />
          <FormMessage state={state} />
          <div className="[&>button]:w-full">
            <SubmitButton pending={pending} pendingText={t.waitlist.joining}>
              {t.waitlist.join}
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
