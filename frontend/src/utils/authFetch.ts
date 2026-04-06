import { buildPath } from './config';
import {
  clearToken,
  retrieveRefreshToken,
  retrieveToken,
  storeTokens,
} from './tokenStorage';

type RequestOptions = RequestInit & { skipAuthRefresh?: boolean };

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = retrieveRefreshToken();
  if (!refreshToken) {
    clearToken();
    return null;
  }

  try {
    const response = await fetch(buildPath('api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearToken();
      return null;
    }

    const data = await response.json();
    if (!data?.accessToken || !data?.refreshToken) {
      clearToken();
      return null;
    }

    storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch (e) {
    clearToken();
    return null;
  }
};

export const authFetch = async (
  route: string,
  options: RequestOptions = {}
): Promise<Response> => {
  const { skipAuthRefresh, headers, ...rest } = options;
  const accessToken = retrieveToken();

  const mergedHeaders = new Headers(headers || {});
  if (accessToken) {
    mergedHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildPath(route), {
    ...rest,
    headers: mergedHeaders,
  });

  if (response.status !== 401 || skipAuthRefresh) {
    return response;
  }

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    return response;
  }

  const retryHeaders = new Headers(headers || {});
  retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);

  return fetch(buildPath(route), {
    ...rest,
    headers: retryHeaders,
  });
};

// Export as authenticatedFetch alias for compatibility
export const authenticatedFetch = authFetch;
