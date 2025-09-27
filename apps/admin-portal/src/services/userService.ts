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

  async getAllRoles(): Promise<{
    id: number;
    name: string;
    description: string;
    isActive: boolean;
  }[]> {
    const { data } = await api.get('/api/users/roles');
    return data;
  },

  async getSyncSettings(): Promise<{
    defaultRoleId: number | null;
    defaultRole: {
      id: number;
      name: string;
      description: string;
    } | null;
    configured: boolean;
  }> {
    const { data } = await api.get('/api/users/sync-settings');
    return data;
  },

  async updateSyncSettings(defaultRoleId: number): Promise<{
    success: boolean;
    defaultRoleId: number;
    defaultRole: {
      id: number;
      name: string;
      description: string;
    };
  }> {
    const { data } = await api.post('/api/users/sync-settings', { defaultRoleId });
    return data;
  },

  syncLegacyUsersBatch(
    users: any[],
    batchSize = 50,
    onProgress?: (progress: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource('/api/users/sync-legacy-batch', {
        withCredentials: true,
      });

      // POST data preko fetch da pokrenemo batch
      fetch('/api/users/sync-legacy-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ users, batchSize }),
      }).then(response => {
        if (!response.ok) {
          throw new Error('Failed to start batch sync');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6);
                  if (jsonStr.trim()) {
                    try {
                      const data = JSON.parse(jsonStr);

                      if (data.type === 'progress' && onProgress) {
                        onProgress(data);
                      } else if (data.type === 'completed' && onComplete) {
                        onComplete(data);
                        resolve();
                        return;
                      } else if (data.type === 'error') {
                        if (onError) onError(data.error);
                        reject(new Error(data.error));
                        return;
                      }
                    } catch (e) {
                      console.warn('Failed to parse SSE data:', jsonStr);
                    }
                  }
                }
              }
            }
          } catch (error: any) {
            if (onError) onError(error.message);
            reject(error);
          }
        };

        readStream();
      }).catch((error: any) => {
        if (onError) onError(error.message);
        reject(error);
      });
    });
  },
};