import { api } from './api';
import type { 
  Role, 
  Permission, 
  RolesResponse, 
  PermissionsResponse, 
  RoleWithPermissions 
} from '../types/rbac.types';

export const rbacService = {
  // Role methods
  async getRoles(page = 1, pageSize = 10): Promise<RolesResponse> {
    const { data } = await api.get('/api/roles', {
      params: { page, pageSize },
    });
    return data;
  },

  async getRole(id: number): Promise<RoleWithPermissions> {
    const { data } = await api.get(`/api/roles/${id}`);
    return data;
  },

  async createRole(roleData: { name: string; description?: string }): Promise<Role> {
    const { data } = await api.post('/api/roles', roleData);
    return data;
  },

  async updateRole(id: number, roleData: { name?: string; description?: string }): Promise<Role> {
    const { data } = await api.patch(`/api/roles/${id}`, roleData);
    return data;
  },

  async deleteRole(id: number): Promise<void> {
    await api.delete(`/api/roles/${id}`);
  },

  // Permission methods
  async getPermissions(): Promise<PermissionsResponse> {
    const { data } = await api.get('/api/permissions');
    return data;
  },

  async getRolePermissions(roleId: number): Promise<Permission[]> {
    const { data } = await api.get(`/api/roles/${roleId}/permissions`);
    return data;
  },

  async updateRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await api.put(`/api/roles/${roleId}/permissions`, { permissionIds });
  },

  async addPermissionToRole(roleId: number, permissionId: number): Promise<void> {
    await api.post(`/api/roles/${roleId}/permissions/${permissionId}`);
  },

  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await api.delete(`/api/roles/${roleId}/permissions/${permissionId}`);
  },
};