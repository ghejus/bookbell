"use client";

import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { Card } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Props = {
  mode: "login" | "signup";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

export function AuthForm({ mode, action }: Props) {
  const { state, pending, formProps } = useActionForm(action);
  const isLogin = mode === "login";

  return (
    <>
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">{isLogin ? "Log in to your shop" : "Create your shop account"}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {isLogin ? "Welcome back." : "Free. Set up your services and hours in a few minutes."}
        </p>
        <form {...formProps} className="mt-6 space-y-5">
          <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            required
            hint={isLogin ? undefined : "At least 8 characters."}
          />
          <FormMessage state={state} />
          <div className="[&>button]:w-full">
            <SubmitButton pending={pending} pendingText={isLogin ? "Logging in…" : "Creating account…"}>
              {isLogin ? "Log in" : "Create account"}
            </SubmitButton>
          </div>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm text-gray-600">
        {isLogin ? "New to Rândul? " : "Already have an account? "}
        <Link href={isLogin ? "/signup" : "/login"} className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </>
  );
}
