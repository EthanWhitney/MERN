// src/utils/tokenStorage.ts - JWT Token Storage Management

const ACCESS_TOKEN_KEY = 'token_data';
const REFRESH_TOKEN_KEY = 'refresh_token_data';

export const storeToken = (token: string): void => {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch (e) {
    console.log('Error storing token:', e);
  }
};

export const storeTokens = (accessToken: string, refreshToken: string): void => {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (e) {
    console.log('Error storing tokens:', e);
  }
};

export const retrieveToken = (): string | null => {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (e) {
    console.log('Error retrieving token:', e);
    return null;
  }
};

export const retrieveRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.log('Error retrieving refresh token:', e);
    return null;
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.log('Error clearing token:', e);
  }
};

export const isTokenValid = (): boolean => {
  const token = retrieveToken();
  return token !== null && token.length > 0;
};
