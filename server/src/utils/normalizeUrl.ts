/**
 * Normalize a URL to origin + pathname for consistent grouping.
 * - Strips query string and hash
 * - Lowercases the host
 * - Removes trailing slash (except root "/")
 */
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // Lowercase host
    url.hostname = url.hostname.toLowerCase();
    // Build normalized: origin + pathname with trailing slash stripped
    const pathname = url.pathname.replace(/\/+$/, '');
    return url.origin + pathname;
  } catch {
    // If URL parsing fails, return the raw string trimmed of trailing slashes
    return raw.trim().replace(/\/+$/, '');
  }
}

