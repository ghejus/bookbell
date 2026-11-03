// Calendar files (.ics) customers can add to their phone's calendar.
// Used by the booking page, the chat, and the confirmation email.

type Event = { start: string; minutes: number; title: string; location: string; shopName: string; uid?: string };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

/** The calendar file's text. Pass `uid` (the booking id) so a moved booking updates the same calendar entry. */
export function buildIcs({ start, minutes, title, location, shopName, uid }: Event): string {
  const begins = new Date(start);
  const ends = new Date(begins.getTime() + minutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookbell//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid ?? `${stamp(begins)}-${Math.random().toString(36).slice(2)}`}@bookbell`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(begins)}`,
    `DTEND:${stamp(ends)}`,
    `SUMMARY:${esc(`${title} at ${shopName}`)}`,
    location ? `LOCATION:${esc(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** A download link for the calendar file. */
export function calendarHref(event: Event): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event))}`;
}
