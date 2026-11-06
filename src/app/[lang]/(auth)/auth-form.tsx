"use client";

import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { StorefrontIcon, UserIcon } from "@/components/icons";
import { useActionForm } from "@/components/use-action-form";
import { Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { useT } from "@/lib/i18n/client";

type Props = {
  mode: "login" | "signup";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** "customer" for people who want to book, "owner" for shops. */
  as: "owner" | "customer";
  /** Where to go afterwards (a page on this site), like the shop page they came from. */
  next?: string;
};

const withQuery = (path: string, q: Record<string, string | undefined>) => {
  const p = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])));
  return p.size ? `${path}?${p}` : path;
};

export function AuthForm({ mode, action, as, next }: Props) {
  const { state, pending, formProps } = useActionForm(action);
  const t = useT();
  const isLogin = mode === "login";
  const customer = as === "customer";

  const title = isLogin ? t.auth.logInTitle : customer ? t.auth.createCustomer : t.auth.createOwner;
  const lead = isLogin ? t.auth.welcomeBack : customer ? t.auth.customerLead : t.auth.ownerLead;

  return (
    <>
      {!isLogin ? (
        <div role="group" aria-label={t.auth.iWantTo} className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border border-line">
          {(
            [
              { key: "owner", label: t.auth.iRunShop, icon: StorefrontIcon },
              { key: "customer", label: t.auth.iWantToBook, icon: UserIcon },
            ] as const
          ).map((o) => {
            const on = o.key === as;
            return (
              <Link
                key={o.key}
                href={withQuery("/signup", { as: o.key === "customer" ? "customer" : undefined, next })}
                replace
                aria-current={on ? "true" : undefined}
                className={`flex h-12 items-center justify-center gap-2 text-sm font-medium transition-colors duration-150 ${
                  on ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"
                }`}
              >
                <o.icon aria-hidden weight={on ? "fill" : "regular"} className="size-[18px]" />
                {o.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <Card className="p-6 sm:p-8">
        <h1 className="text-[22px] font-medium tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-neutral-400">{lead}</p>
        <form {...formProps} className="mt-6 space-y-5">
          <input type="hidden" name="as" value={as} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {!isLogin && customer ? <Field label={t.common.yourName} name="name" autoComplete="name" maxLength={80} required hint={t.auth.nameHint} /> : null}
          <Field label={t.common.email} name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
          <Field
            label={t.auth.password}
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            required
            hint={isLogin ? undefined : t.auth.passwordHint}
          />
          <FormMessage state={state} />
          <div className="[&>button]:w-full">
            <SubmitButton pending={pending} pendingText={isLogin ? t.auth.loggingIn : t.auth.creating}>
              {isLogin ? t.common.logIn : t.auth.createAccount}
            </SubmitButton>
          </div>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-neutral-400">
        {isLogin ? t.auth.newHere : t.auth.haveAccount}
        <Link
          href={withQuery(isLogin ? "/signup" : "/login", { as: customer ? "customer" : undefined, next })}
          className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
        >
          {isLogin ? t.auth.createAnAccount : t.common.logIn}
        </Link>
      </p>
    </>
  );
}
