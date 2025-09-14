import { api } from './api';
import axios from 'axios';
import { LoginRequest, LoginResponse, RefreshTokenResponse } from '../types/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Login ne koristi api instance jer još nema token
    const response = await axios.post(`${API_URL}/api/auth/login`, credentials, {
      withCredentials: true,
    });
    console.log('Auth service - Login response:', response.data);
    console.log('Auth service - User avatar:', response.data.user?.avatar);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    // Refresh takođe ne koristi api instance da izbegne cirkularne pozive
    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
      refreshToken,
    });
    console.log('Auth service - Refresh response:', response.data);
    console.log('Auth service - Refresh User avatar:', response.data.user?.avatar);
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