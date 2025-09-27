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

  async getAllEmails(): Promise<Set<string>> {
    const { data } = await api.get('/api/users/emails');
    return new Set(data.emails.map((e: string) => e.toLowerCase()));
  },

  async getExistingUsersForSync(): Promise<{ emails: Set<string>; legacyIds: Set<number> }> {
    const { data } = await api.get('/api/users/existing-sync');
    return {
      emails: new Set(data.emails),
      legacyIds: new Set(data.legacyIds)
    };
  },

  async fetchLegacyUsers(): Promise<{
    source: any;
    totalRecords: number;
    data: any[];
    message?: string;
    syncGroups?: any[];
  }> {
    const { data } = await api.get('/api/users/legacy');
    return data;
  },

  async syncLegacyUsers(users: any[]): Promise<{
    success: number;
    skipped: number;
    errors: number;
    duplicates?: { email: string; firstName: string; lastName: string }[];
  }> {
    const { data } = await api.post('/api/users/sync-legacy', { users });
    return data;
  },
};