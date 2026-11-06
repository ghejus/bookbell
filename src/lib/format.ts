// Small display helpers shared by server and browser code.

export const CURRENCIES = ["EUR", "RON"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = { EUR: "Euro (€)", RON: "Romanian lei (lei)" };

/** Short unit shown beside price inputs. */
export const CURRENCY_UNIT: Record<Currency, string> = { EUR: "€", RON: "lei" };

/** No-break space: keeps a number and its unit on one line ("60 lei", "30 min"). */
const NBSP = String.fromCharCode(160);

/**
 * 2550 cents -> "€25.50" or "25.50 lei". Whole amounts drop the decimals: "€25", "60 lei".
 * Null (no price set) -> "". Zero -> "Free".
 */
export function formatPrice(cents: number | null, currency: Currency): string {
  if (cents === null) return "";
  if (cents === 0) return "Free";
  const amount = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return currency === "EUR" ? `€${amount}` : `${amount}${NBSP}lei`;
}

/** An amount of money (takings, totals): like formatPrice, but zero is "€0", not "Free". */
export function formatMoney(cents: number, currency: Currency): string {
  return cents === 0 ? (currency === "EUR" ? "€0" : `0${NBSP}lei`) : formatPrice(cents, currency);
}

/** 90 -> "1 h 30 min", 45 -> "45 min", 60 -> "1 h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NBSP}min`;
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h ${m}${NBSP}min`;
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
