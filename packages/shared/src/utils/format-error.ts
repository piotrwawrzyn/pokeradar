/**
 * Extracts a human-readable message from an unknown error value.
 */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
