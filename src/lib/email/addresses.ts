// Addresses that must never get a real email: the demo shop's sample customers
// and the test accounts. Plain function (no server code), so it is easy to test.

const TEST_DOMAINS = ["example.com", "example.org", "example.net", "randul-test.dev"];
const TEST_ENDINGS = [".test", ".invalid", ".localhost", ".local", ".example"];

export function isTestAddress(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1) return true; // not an address at all
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return true;
  if (TEST_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return TEST_ENDINGS.some((end) => domain.endsWith(end));
}

/** "maria.popescu@gmail.com" -> "m***@gmail.com", for logs. */
export function maskAddress(email: string): string {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}***@${domain}` : "***";
}
