// Backend API configuration that adapts to environment
export const getApiBaseUrl = (): string => {
  if (import.meta.env.MODE === 'production') {
    // Use same domain as frontend - Nginx proxies /api/ to backend
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

export const buildPath = (route: string): string => {
  const baseUrl = getApiBaseUrl();
  // If route already starts with /, don't add another slash
  if (route.startsWith('/')) {
    return `${baseUrl}${route}`;
  }
  return `${baseUrl}/${route}`;
};
