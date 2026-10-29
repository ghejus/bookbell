// Time zone helpers. Dates in the database are stored in UTC; shops think in
// their own local time. These convert between the two without extra libraries.

/** True if `tz` is a time zone name the browser/Node understands, like "Europe/Bucharest". */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** How many minutes `tz` is ahead of UTC at the moment `utcMs`. */
function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/**
 * Turns a wall-clock time in a shop's time zone into a real moment (Date).
 * `date` is "YYYY-MM-DD", `time` is "HH:MM".
 * Example: ("2026-11-02", "09:00", "Europe/Bucharest") -> 2026-11-02T07:00:00Z.
 * If the time doesn't exist (clocks jump forward), it moves to the next real time.
 */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Guess with the offset at that moment, then correct once for daylight saving changes.
  let result = wallAsUtc - offsetMinutes(wallAsUtc, tz) * 60000;
  const corrected = wallAsUtc - offsetMinutes(result, tz) * 60000;
  if (corrected !== result) result = Math.max(result, corrected);
  return new Date(result);
}

/** The local "YYYY-MM-DD" and "HH:MM" for a moment, as seen in `tz`. */
export function utcToZoned(moment: Date, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(moment);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
