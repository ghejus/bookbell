import "server-only";
import { cookies } from "next/headers";

// A short message for the next page, like "Booking added", shown as a toast.
// A server action leaves it in a small cookie; the page shows it once and the
// browser deletes the cookie (see components/toast.tsx).

export type FlashKind = "added" | "cancelled" | "moved" | "saved";
export type Flash = { id: string; kind: FlashKind; title: string; text: string };

const NAME = "bb_flash";

export async function flash(kind: FlashKind, title: string, text = "") {
  const value: Flash = { id: `${Date.now()}`, kind, title: title.slice(0, 80), text: text.slice(0, 160) };
  (await cookies()).set(NAME, encodeURIComponent(JSON.stringify(value)), { path: "/", maxAge: 60, sameSite: "lax" });
}

/** The waiting message, if any. */
export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(NAME)?.value;
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Flash;
    return typeof value?.id === "string" && typeof value.title === "string" ? value : null;
  } catch {
    return null;
  }
}
