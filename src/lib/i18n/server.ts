import "server-only";
import { headers } from "next/headers";
import { lang } from "next/root-params";
import { DEFAULT_LANG, isLang, LANG_HEADER, type Lang } from "./config";
import { dictFor } from "./dict";

// The visitor's language on the server.

/** In pages and layouts: from the hidden /en or /ro folder the proxy picked. */
export async function pageLang(): Promise<Lang> {
  const value = await lang();
  return isLang(value) ? value : DEFAULT_LANG;
}

/** Words for pages and layouts. */
export async function getT() {
  return dictFor(await pageLang());
}

/** In server actions and route handlers (which can't read the folder): from the proxy's header. */
export async function actionLang(): Promise<Lang> {
  const value = (await headers()).get(LANG_HEADER);
  return isLang(value) ? value : DEFAULT_LANG;
}

/** Words for server actions and route handlers. */
export async function getActionT() {
  return dictFor(await actionLang());
}
