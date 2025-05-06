/**
 * Generates a unique ID using a combination of timestamp and random values
 * @returns A string containing a unique identifier
 */
export function generateId(): string {
  // Combine timestamp with random string to ensure uniqueness
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
} 