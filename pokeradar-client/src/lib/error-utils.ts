interface ApiErrorResponse {
  response?: {
    data?: {
      error?: string;
      details?: Array<{ path?: string[]; message: string }>;
    };
  };
  message?: string;
}

/**
 * Extracts a user-friendly error message from an API error response.
 * Includes validation details if available.
 */
export function getErrorMessage(error: unknown, fallbackMessage: string): string {
  const apiError = error as ApiErrorResponse;
  let message = apiError?.response?.data?.error || apiError?.message || fallbackMessage;

  // If there are validation details, append them
  if (apiError?.response?.data?.details) {
    const details = apiError.response.data.details
      .map((d) => `${d.path?.join('.') || 'field'}: ${d.message}`)
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
