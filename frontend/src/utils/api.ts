import { isAbsolute } from './url';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

/**
 * Constructs an API URL that works with both absolute and relative base URLs.
 * If API_BASE is absolute (e.g. http://localhost:5000/api), uses that directly.
 * If API_BASE is relative (e.g. /api), uses the current origin.
 */
export const buildApiUrl = (path: string, searchParams?: Record<string, string>): string => {
  const fullPath = `${API_BASE}${path}`;
  
  // If we have an absolute URL from env, use it directly
  if (isAbsolute(API_BASE)) {
    const url = new URL(fullPath);
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }
  
  // For relative URLs, construct the search string if needed
  let searchString = '';
  if (searchParams) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      params.set(key, value);
    });
    searchString = `?${params.toString()}`;
  }
  
  return `${fullPath}${searchString}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  files: '/files',
  workspace: '/workspace',
  playingLayers: '/playing-layers',
  soundboard: '/soundboard/play',
} as const; 