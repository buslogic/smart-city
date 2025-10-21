/**
 * Runtime Configuration - Kubernetes ConfigMap Placeholder
 *
 * This file is intentionally empty for Vercel and local development.
 * The app will use import.meta.env.VITE_* variables instead.
 *
 * In Kubernetes, this file will be REPLACED by a ConfigMap that sets window.APP_CONFIG.
 *
 * Priority (handled by src/config/runtime.ts):
 * 1. window.APP_CONFIG (Kubernetes ConfigMap) - if set, use it
 * 2. import.meta.env.VITE_* (Vercel/local .env) - fallback
 * 3. Hardcoded defaults (localhost:3010) - final fallback
 */

// DO NOT set window.APP_CONFIG here!
// Let runtime.ts handle the fallback chain.

// Log for debugging
if (typeof console !== 'undefined' && console.log) {
  if (window.APP_CONFIG) {
    console.log('[Config] Using Kubernetes ConfigMap');
    console.log('[Config] API_URL:', window.APP_CONFIG.API_URL);
  } else {
    console.log('[Config] No ConfigMap found, using build-time env variables');
  }
}
