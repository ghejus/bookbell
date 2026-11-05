import "server-only";
import type { AccountInfo } from "@/components/account-sheet";
import { requireUser } from "@/lib/shop";

type Person = { email: string; name: string; isDemo: boolean };

/** What the account button and sheet show for a person. */
export function accountFor({ email, name, isDemo }: Person): AccountInfo {
  if (isDemo) return { initial: "D", name: "Demo account", sub: "Nobody else sees your changes.", isDemo };
  return { initial: ((name || email)[0] ?? "?").toUpperCase(), name: name || email, sub: name ? email : "Signed in", isDemo };
}

/** The same, for the signed-in person (or a trip to the log-in page). */
export async function accountInfo(): Promise<AccountInfo> {
  return accountFor(await requireUser());
}
