import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Inter, the website's font, for pictures drawn on the server (share pictures).
// The files live in assets/fonts (Inter is free to use under the SIL Open Font License).
const load = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | undefined;

/** The three Inter weights, read from disk once and then remembered. */
export function interFonts() {
  fonts ??= Promise.all([
    load("Inter-Regular.ttf").then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
    load("Inter-SemiBold.ttf").then((data) => ({ name: "Inter", data, weight: 600 as const, style: "normal" as const })),
    load("Inter-Bold.ttf").then((data) => ({ name: "Inter", data, weight: 700 as const, style: "normal" as const })),
  ]);
  return fonts;
}
