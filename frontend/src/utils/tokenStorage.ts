// src/utils/tokenStorage.ts - JWT Token Storage Management

export const storeToken = (token: string): void => {
  try {
    localStorage.setItem('token_data', token);
  } catch (e) {
    console.log('Error storing token:', e);
  }
};

export const retrieveToken = (): string | null => {
  try {
    return localStorage.getItem('token_data');
  } catch (e) {
    console.log('Error retrieving token:', e);
    return null;
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem('token_data');
  } catch (e) {
    console.log('Error clearing token:', e);
  }
};

export const isTokenValid = (): boolean => {
  const token = retrieveToken();
  return token !== null && token.length > 0;
};
