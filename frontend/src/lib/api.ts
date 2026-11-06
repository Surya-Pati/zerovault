const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
export const API_URL = cleanBaseUrl.endsWith('/api') ? cleanBaseUrl : `${cleanBaseUrl}/api`;

/**
 * Fetch wrapper that automatically handles CSRF tokens and Authorization headers.
 * Uses httpOnly cookies for session auth, and Bearer token for API calls that need it.
 */
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  // Add CSRF token for state-changing requests
  if (options.method && options.method !== 'GET' && !headers.has('x-csrf-token')) {
    try {
      const csrfRes = await fetch(`${API_URL}/auth/csrf-token`, { credentials: 'include' });
      if (csrfRes.ok) {
        const { csrfToken } = await csrfRes.json();
        headers.set('x-csrf-token', csrfToken);
      }
    } catch (e) {
      // CSRF fetch failed — request will likely fail with CSRF error
      console.warn('Failed to fetch CSRF token');
    }
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${API_URL}${normalizedEndpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  return response;
};
