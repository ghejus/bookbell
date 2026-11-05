"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { createDemoShop } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/env";
import { requireUser } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, firstError, safeNextPath } from "@/lib/validation";

const NOT_CONNECTED = "The database isn't connected yet. See the setup steps in README.md.";

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host")}`;
}

/** Plain-language messages instead of raw Supabase errors. */
function signupErrorMessage(code: string | undefined): string {
  switch (code) {
    case "weak_password":
      return "That password is too easy to guess. Try a longer one with a mix of words and numbers.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many sign-ups in a short time. Please wait a few minutes and try again.";
    case "email_address_invalid":
      return "That email address can't receive mail. Please check it.";
    case "signup_disabled":
      return "New sign-ups are paused right now. Please try again later.";
    default:
      return "Could not create the account. Please try again.";
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
  if (!hasSupabaseEnv) return { error: NOT_CONNECTED };
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const customer = formData.get("as") === "customer";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (customer && !name) return { error: "Type your name." };
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
  if (error) return { error: signupErrorMessage(error.code) };

  // If email confirmation is turned off in Supabase, the user is logged in right away.
  if (data.session) redirect(next);

  // Same message whether or not the email already had an account, so strangers
  // can't use this form to find out who has signed up.
  return { message: "Almost done! Check your email and click the link to confirm your account." };
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseEnv) return { error: NOT_CONNECTED };
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Wrong email or password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Look for our message in your inbox." };
    }
    return { error: "Wrong email or password." };
  }
  // /start sends shop owners to their shop and everyone else to My bookings.
  redirect(afterAuth(formData, "/start"));
}

/**
 * After the browser signs in with a no-email demo account, this fills it with
 * a sample shop and opens the dashboard.
 */
export async function startDemo(): Promise<ActionState> {
  if (!hasSupabaseEnv) return { error: NOT_CONNECTED };
  const { supabase, userId, isDemo } = await requireUser();
  if (!isDemo) redirect("/dashboard"); // A real owner pressed it: just go to their shop.
  try {
    await createDemoShop(supabase, userId);
  } catch (error) {
    console.error(error);
    return { error: "Could not make your demo shop. Please try again." };
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
