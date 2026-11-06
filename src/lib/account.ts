import "server-only";
import type { AccountInfo } from "@/components/account-sheet";
import { en } from "@/lib/i18n/en";
import type { Dict } from "@/lib/i18n/dict";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/shop";

type Person = { email: string; name: string; isDemo: boolean };

/** What the account button and sheet show for a person. */
export function accountFor({ email, name, isDemo }: Person, t: Dict = en): AccountInfo {
  if (isDemo) return { initial: "D", name: t.account.demoName, sub: t.account.demoSub, isDemo };
  return { initial: ((name || email)[0] ?? "?").toUpperCase(), name: name || email, sub: name ? email : t.account.signedIn, isDemo };
}

/** The same, for the signed-in person (or a trip to the log-in page). */
export async function accountInfo(): Promise<AccountInfo> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  return accountFor(user, t);
}
