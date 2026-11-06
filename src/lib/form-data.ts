/** A form's fields as plain text values (React's own hidden "$..." fields left out). */
export const fields = (formData: FormData): Record<string, string> =>
  Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
