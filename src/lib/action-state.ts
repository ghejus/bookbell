// What a form action sends back to the page: an error to show, or a success note.
// `values` lets a form keep what the person typed when there's an error.
export type ActionState = { error?: string; message?: string; values?: Record<string, string> } | undefined;
