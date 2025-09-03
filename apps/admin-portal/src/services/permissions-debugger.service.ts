import { api } from './api';
import type { PermissionDebugInfo } from '../types/permissions-debugger';

export const permissionsDebuggerService = {
  async getDebugInfo(currentRoute?: string): Promise<PermissionDebugInfo> {
    const params = currentRoute ? `?route=${encodeURIComponent(currentRoute)}` : '';
    const { data } = await api.get(`/api/permissions/debug-info${params}`);
    return data;
  },
};