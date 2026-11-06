// Plain words for the short error codes the database uses when it refuses
// a booking, a move or a cancellation. The words live in the language lists
// (lib/i18n); this English version is for screens that only speak English.

import { en } from "./i18n/en";

export const bookingErrors = en.errors;

export function bookingError(code: string | undefined, fallback = "Something went wrong. Please try again."): string {
  return (code && bookingErrors[code]) || fallback;
}
