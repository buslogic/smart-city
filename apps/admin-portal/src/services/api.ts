import axios from 'axios';
import { TokenManager } from '../utils/token';
import { API_URL } from '../config/runtime';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = TokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ako šaljemo FormData, ukloni Content-Type da browser automatski postavi multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Promise za praćenje trenutnog refresh zahteva (singleton pattern)
let refreshTokenPromise: Promise<any> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = TokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Ako već postoji refresh zahtev u toku, sačekaj ga
        if (!refreshTokenPromise) {
          refreshTokenPromise = axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          }).finally(() => {
            refreshTokenPromise = null; // Reset promise nakon završetka
          });
        }

        const response = await refreshTokenPromise;
        const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;

        // Ažuriraj tokene koristeći TokenManager
        TokenManager.setTokens(accessToken, newRefreshToken || refreshToken, expiresIn || 3600);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshTokenPromise = null; // Reset na grešku
        TokenManager.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);