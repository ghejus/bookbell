import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestAddress, maskAddress } from "./addresses";

// The post office. Sends through a Gmail account (GMAIL_USER + GMAIL_APP_PASSWORD).
// Without them, emails are only written to the server log ("log only"), so the
// whole app still works on a computer with no email set up.

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
};

export type SendResult = "sent" | "logged" | "skipped" | "limited" | "failed";

/** At most this many emails a day, well under Gmail's limit of about 500. */
const DAILY_LIMIT = 100;

let transport: Transporter | undefined;

export function emailMode(): "gmail" | "log" {
  return process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? "gmail" : "log";
}

/** Booking links are secret, so they never appear in logs on the live site. */
const hideLinks = (text: string) =>
  process.env.NODE_ENV === "production" ? text.replace(/\/b\/[0-9a-f]{48}/g, "/b/<secret>") : text;

/** Counts today's emails in the database. Without the server key, there is no counter. */
async function underDailyLimit(): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.rpc("take_email_slot", { p_limit: DAILY_LIMIT });
  if (error) {
    console.error("[email] could not check the daily limit:", error.message);
    return true;
  }
  return data === true;
}

/** Sends one email. Never throws: a failed email must never break a booking. */
export async function sendEmail(mail: Mail): Promise<SendResult> {
  try {
    if (!mail.to || isTestAddress(mail.to)) return "skipped";

    if (emailMode() === "log") {
      console.info(`[email] log only (no Gmail set up) to ${maskAddress(mail.to)}: ${mail.subject}\n${hideLinks(mail.text)}`);
      return "logged";
    }

    if (!(await underDailyLimit())) {
      console.warn(`[email] daily limit of ${DAILY_LIMIT} reached; not sent: ${mail.subject}`);
      return "limited";
    }

    transport ??= nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transport.sendMail({
      from: { name: "Bookbell", address: process.env.GMAIL_USER! },
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    });
    return "sent";
  } catch (error) {
    console.error(`[email] failed to ${maskAddress(mail.to)}: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  }
}
