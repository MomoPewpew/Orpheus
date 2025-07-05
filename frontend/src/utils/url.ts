/**
 * Check if a URL is absolute (starts with http:// or https://)
 */
export const isAbsolute = (url: string): boolean => /^https?:\/\//i.test(url); 