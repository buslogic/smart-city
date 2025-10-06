/**
 * Runtime Configuration Helper
 *
 * Enables dynamic configuration loading for Kubernetes deployments
 * while maintaining backward compatibility with Vite env variables.
 *
 * Priority (fallback chain):
 * 1. window.APP_CONFIG (Kubernetes ConfigMap)
 * 2. import.meta.env.VITE_* (Vercel/local .env)
 * 3. Hardcoded defaults (localhost)
 */

interface AppConfig {
  API_URL: string;
  WS_URL: string;
  COMPANY_NAME?: string;
  ENVIRONMENT?: string;
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
}

export const getRuntimeConfig = (): AppConfig => {
  // Priority 1: Kubernetes ConfigMap (runtime)
  if (window.APP_CONFIG) {
    return window.APP_CONFIG;
  }

  // Priority 2: Vite env variables (build-time)
  return {
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3010',
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3010',
    COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME || 'Smart City',
    ENVIRONMENT: import.meta.env.MODE || 'development',
  };
};

// Export individual config values for convenience
export const API_URL = getRuntimeConfig().API_URL;
export const WS_URL = getRuntimeConfig().WS_URL;
export const COMPANY_NAME = getRuntimeConfig().COMPANY_NAME;
export const ENVIRONMENT = getRuntimeConfig().ENVIRONMENT;

// Export function to get fresh config (useful for debugging)
export const getConfig = getRuntimeConfig;
