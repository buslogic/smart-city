export interface Role {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    permissions: number;
  };
}

export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  roleId: number;
  permissionId: number;
  grantedAt: string;
  permission: Permission;
}

export interface RolesResponse {
  data: Role[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PermissionsResponse {
  data: Permission[];
  total: number;
}

export interface RoleWithPermissions {
  id: number;
  name: string;
  description: string | null;
  permissions: RolePermission[];
}