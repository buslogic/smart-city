import { api } from './api';
import type { User, UsersResponse } from '../types/user.types';

export const userService = {
  async getUsers(page = 1, pageSize = 10): Promise<UsersResponse> {
    const { data } = await api.get('/api/users', {
      params: {
        page,
        pageSize,
      },
    });
    return data;
  },

  async getUser(id: number): Promise<User> {
    const { data } = await api.get(`/api/users/${id}`);
    return data;
  },

  async createUser(userData: Partial<User>): Promise<User> {
    const { data } = await api.post('/api/users', userData);
    return data;
  },

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const { data } = await api.patch(`/api/users/${id}`, userData);
    return data;
  },

  async deleteUser(id: number): Promise<void> {
    await api.delete(`/api/users/${id}`);
  },

  async toggleUserStatus(id: number, isActive: boolean): Promise<User> {
    const { data } = await api.patch(`/api/users/${id}/status`, { isActive });
    return data;
  },
};