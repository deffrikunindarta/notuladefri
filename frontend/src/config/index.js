// Environment configuration for deployment
const getApiBaseUrl = () => {
  // Production environment
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'https://notulakika-backend.vercel.app';
  }
  
  // Development environment
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
};

export const API_BASE_URL = getApiBaseUrl();

// Other configuration
export const config = {
  apiUrl: API_BASE_URL,
  environment: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  version: '1.0.0'
};
