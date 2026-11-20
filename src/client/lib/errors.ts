/** A server refusal as one readable sentence. */
export function errorMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  try {
    const issues = JSON.parse(raw) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    // Not a list of validation issues.
  }
  return raw || "That didn't work. Try again.";
}
