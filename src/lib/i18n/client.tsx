"use client";

import { createContext, use } from "react";
import { DEFAULT_LANG, type Lang } from "./config";
import { dictFor } from "./dict";

// The visitor's language in browser code. The root layout wraps every page in
// <LangProvider>, so any client component can call useT().

const LangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => use(LangContext);
export const useT = () => dictFor(use(LangContext));
