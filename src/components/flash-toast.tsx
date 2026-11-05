import { readFlash } from "@/lib/flash";
import { Toast } from "./toast";

/** Shows the message a server action left for this page, if there is one. */
export async function FlashToast() {
  const flash = await readFlash();
  return flash ? <Toast key={flash.id} flash={flash} /> : null;
}
