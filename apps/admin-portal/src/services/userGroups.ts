import { api } from './api';

export interface UserGroup {
  id: number;
  groupName: string;
  driver: boolean;
  userClass: number;
  description: string | null;
  isActive: boolean;
  syncEnabled: boolean;
  legacyId: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
}

export interface CreateUserGroupDto {
  groupName: string;
  driver?: boolean;
  userClass?: number;
  description?: string;
  isActive?: boolean;
}

export interface UpdateUserGroupDto {
  groupName?: string;
  driver?: boolean;
  userClass?: number;
  description?: string;
  isActive?: boolean;
}

export interface UserInGroup {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
}

class UserGroupsService {
  async getAll(params?: {
    includeInactive?: boolean;
    driver?: boolean;
    userClass?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.includeInactive) queryParams.append('includeInactive', 'true');
    if (params?.driver !== undefined) queryParams.append('driver', String(params.driver));
    if (params?.userClass) queryParams.append('userClass', String(params.userClass));

    const response = await api.get<UserGroup[]>(`/api/user-groups?${queryParams}`);
    return response.data;
  }

  async getById(id: number) {
    const response = await api.get<UserGroup>(`/api/user-groups/${id}`);
    return response.data;
  }

  async create(data: CreateUserGroupDto) {
    const response = await api.post<UserGroup>('/api/user-groups', data);
    return response.data;
  }

  async update(id: number, data: UpdateUserGroupDto) {
    const response = await api.put<UserGroup>(`/api/user-groups/${id}`, data);
    return response.data;
  }

  async delete(id: number) {
    const response = await api.delete(`/api/user-groups/${id}`);
    return response.data;
  }

  async getUsersInGroup(groupId: number) {
    const response = await api.get<UserInGroup[]>(`/api/user-groups/${groupId}/users`);
    return response.data;
  }

  async addUserToGroup(groupId: number, userId: number) {
    const response = await api.post(`/api/user-groups/${groupId}/users/${userId}`);
    return response.data;
  }

  async removeUserFromGroup(groupId: number, userId: number) {
    const response = await api.delete(`/api/user-groups/${groupId}/users/${userId}`);
    return response.data;
  }

  async updateSyncStatus(updates: { id: number; syncEnabled: boolean; legacyId?: number }[]) {
    const response = await api.post('/api/user-groups/bulk-sync-status', updates);
    return response.data;
  }

  async fetchLegacyGroups() {
    const response = await api.get('/api/user-groups/legacy/fetch');
    return response.data;
  }
}

export const userGroupsService = new UserGroupsService();