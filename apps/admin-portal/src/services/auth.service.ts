import { api } from './api';
import axios from 'axios';
import { LoginRequest, LoginResponse, RefreshTokenResponse } from '../types/auth';
import { API_URL } from '../config/runtime';

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Login ne koristi api instance jer još nema token
    const response = await axios.post(`${API_URL}/api/auth/login`, credentials, {
      withCredentials: true,
    });
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    // Refresh takođe ne koristi api instance da izbegne cirkularne pozive
    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
      refreshToken,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async getProfile() {
    const { data } = await api.get('/api/auth/profile');
    return data;
  }

  async requestPasswordReset(email: string): Promise<void> {
    await axios.post(`${API_URL}/api/auth/request-password-reset`, { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await axios.post(`${API_URL}/api/auth/reset-password`, {
      token,
      newPassword
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    });
  }
}

export const authService = new AuthService();