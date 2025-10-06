/**
 * Runtime Configuration - Fallback for Development
 *
 * This file provides default configuration for local development.
 * In Kubernetes, this file will be replaced by a ConfigMap.
 *
 * Priority:
 * 1. Kubernetes ConfigMap (overrides this file)
 * 2. This fallback (for local dev and Vercel)
 */

// Initialize APP_CONFIG only if not already set (Kubernetes will set it first)
window.APP_CONFIG = window.APP_CONFIG || {
  API_URL: 'http://localhost:3010',
  WS_URL: 'ws://localhost:3010',
  COMPANY_NAME: 'Smart City Development',
  ENVIRONMENT: 'development'
};

// Log config source for debugging
if (typeof console !== 'undefined' && console.log) {
  console.log('[Config] Loaded from:', window.APP_CONFIG.ENVIRONMENT === 'development' ? 'fallback (public/config.js)' : 'Kubernetes ConfigMap');
  console.log('[Config] API_URL:', window.APP_CONFIG.API_URL);
}
