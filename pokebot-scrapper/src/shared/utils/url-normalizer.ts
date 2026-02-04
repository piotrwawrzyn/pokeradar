/**
 * URL normalization utilities.
 */

/**
 * Normalizes a URL by handling relative, protocol-relative, and absolute paths.
 *
 * @param url - The URL to normalize
 * @param baseUrl - The base URL for resolving relative paths
 * @returns Fully qualified URL
 */
export function normalizeUrl(url: string, baseUrl: string): string {
  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative URL
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // Absolute path
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }

  // Relative path
  return `${baseUrl}/${url}`;
}

/**
 * Builds a search URL from template and query.
 *
 * @param baseUrl - The base URL of the shop
 * @param searchUrl - The search URL template with optional {query} placeholder
 * @param query - The search query to insert
 * @returns Complete search URL
 */
export function buildSearchUrl(
  baseUrl: string,
  searchUrl: string,
  query: string
): string {
  const encodedQuery = encodeURIComponent(query);
  const searchPath = searchUrl.includes('{query}')
    ? searchUrl.replace('{query}', encodedQuery)
    : `${searchUrl}${encodedQuery}`;

  return `${baseUrl}${searchPath}`;
}
