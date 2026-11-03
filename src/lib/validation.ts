import { z } from "zod";
import { CURRENCIES } from "./format";
import { isValidTimeZone, zonedToUtc } from "./time";

// Everything people type goes through these checks before it reaches the database.

const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.");

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Type a valid email address.")),
  password: z.string().min(8, "Password needs at least 8 characters.").max(72),
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Web address needs at least 3 characters.")
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use only small letters, numbers and single dashes.");

export const shopSchema = z.object({
  name: text(80, 2),
  slug: slugSchema,
  timezone: z.string().trim().refine(isValidTimeZone, "Unknown time zone."),
  currency: z.enum(CURRENCIES, "Pick euro or lei."),
  about: text(1000),
  address: text(200),
  phone: text(40),
});

/** "25" or "25.50" -> 2550 cents. Empty -> null (price not shown). */
const priceToCents = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!/^\d{1,6}([.,]\d{1,2})?$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "Use a price like 25 or 25.50." });
      return z.NEVER;
    }
    return Math.round(Number(value.replace(",", ".")) * 100);
  });

export const serviceSchema = z.object({
  name: text(80, 1),
  duration_minutes: z.coerce.number().int().min(5, "At least 5 minutes.").max(480, "At most 8 hours."),
  price_cents: priceToCents,
});

export const openingHoursSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    opens: hhmm,
    closes: hhmm,
  })
  .refine((v) => v.closes > v.opens, { message: "Closing time must be after opening time.", path: ["closes"] });

/** Builds the time-off check for one shop, because the times are in that shop's time zone. */
export function timeOffSchema(timezone: string) {
  return z
    .object({
      starts_at: localDateTime,
      ends_at: localDateTime,
      reason: text(200),
      // Empty: the whole shop is closed. Otherwise only this worker is off.
      staff_id: z.union([z.uuid(), z.literal("")]).optional(),
    })
    .transform((v) => ({
      starts_at: zonedToUtc(v.starts_at.slice(0, 10), v.starts_at.slice(11), timezone),
      ends_at: zonedToUtc(v.ends_at.slice(0, 10), v.ends_at.slice(11), timezone),
      reason: v.reason,
      staff_id: v.staff_id || null,
    }))
    .refine((v) => v.ends_at > v.starts_at, { message: "The end must be after the start.", path: ["ends_at"] });
}

export const shopInfoSchema = z.object({
  question: text(200, 1),
  answer: text(1000, 1),
});

export const staffSchema = z.object({
  name: z.string().trim().min(1, "Type a name.").max(60, "Use at most 60 characters."),
});

export const idSchema = z.uuid();

/** "Bob's Barber Shop!" -> "bobs-barber-shop" (a suggestion for the web address). */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Only allow redirects to pages on our own site, never to other websites. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // Browsers drop tabs and newlines from URLs, so "/<tab>/evil.example" would become "//evil.example".
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** Turns a zod error into one short sentence for the form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form";
}
