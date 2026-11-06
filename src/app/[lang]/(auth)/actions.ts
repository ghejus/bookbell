"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { createDemoShop } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { getActionT } from "@/lib/i18n/server";
import type { Dict } from "@/lib/i18n/dict";
import { safeNextPath } from "@/lib/validation";
import { z } from "zod";

/** Email and password, with messages in the visitor's language. */
const credentials = (t: Dict) =>
  z.object({
    email: z.string().trim().toLowerCase().pipe(z.email(t.auth.errors.invalidEmail)),
    password: z.string().min(8, t.auth.errors.shortPassword).max(72),
  });

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host")}`;
}

/** Plain-language messages instead of raw Supabase errors. */
function signupErrorMessage(t: Dict, code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return t.auth.errors.weakPassword;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t.auth.errors.tooMany;
    case "email_address_invalid":
      return t.auth.errors.badEmail;
    case "signup_disabled":
      return t.auth.errors.paused;
    default:
      return t.auth.errors.failed;
  }
}

/**
 * Where to go after logging in or signing up: back to the page they came from
 * (like a shop's booking page), or else their side of the app.
 */
function afterAuth(formData: FormData, fallback: string) {
  return safeNextPath(String(formData.get("next") ?? ""), fallback);
}

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionT();
  if (!hasSupabaseEnv) return { error: t.auth.errors.notConnected };
  const parsed = credentials(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.auth.errors.failed };
  const customer = formData.get("as") === "customer";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (customer && !name) return { error: t.auth.errors.typeName };
  const next = afterAuth(formData, customer ? "/my" : "/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      // Customers' names fill in the booking form for them.
      data: name ? { full_name: name } : undefined,
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: signupErrorMessage(t, error.code) };

  // If email confirmation is turned off in Supabase, the user is logged in right away.
  if (data.session) redirect(next);

  // Same message whether or not the email already had an account, so strangers
  // can't use this form to find out who has signed up.
  return { message: t.auth.errors.checkEmail };
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getActionT();
  if (!hasSupabaseEnv) return { error: t.auth.errors.notConnected };
  const parsed = credentials(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.auth.errors.wrongLogin };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: t.auth.errors.confirmFirst };
    }
    return { error: t.auth.errors.wrongLogin };
  }
  // /start sends shop owners to their shop and everyone else to My bookings.
  redirect(afterAuth(formData, "/start"));
}

/**
 * After the browser signs in with a no-email demo account, this fills it with
 * a sample shop and opens the dashboard.
 */
export async function startDemo(): Promise<ActionState> {
  const t = await getActionT();
  if (!hasSupabaseEnv) return { error: t.auth.errors.notConnected };
  const { supabase, userId, isDemo } = await requireUser();
  if (!isDemo) redirect("/dashboard"); // A real owner pressed it: just go to their shop.
  try {
    await createDemoShop(supabase, userId);
  } catch (error) {
    console.error(error);
    return { error: t.demo.failed };
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
