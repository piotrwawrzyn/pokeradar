/**
 * Extracts a user-friendly error message from an API error response.
 * Includes validation details if available.
 */
export function getErrorMessage(error: any, fallbackMessage: string): string {
  let message = error?.response?.data?.error || error?.message || fallbackMessage;

  // If there are validation details, append them
  if (error?.response?.data?.details) {
    const details = error.response.data.details
      .map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`)
      .join(', ');
    message = `${message}: ${details}`;
  }

  return message;
}

/**
 * Generates a URL-friendly ID from a name.
 * Converts to lowercase and replaces spaces with hyphens.
 */
export function generateIdFromName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}
