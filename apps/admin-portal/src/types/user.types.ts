export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: string[]; // Sada je array stringova umesto objekata
  permissions?: string[]; // Dodato i permissions
  userGroupId?: number | null;
  userGroup?: {
    id: number;
    groupName: string;
    driver: boolean;
    userClass: number;
    description: string | null;
    isActive: boolean;
  } | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  userId: number;
  roleId: number;
  assignedAt: string;
  role: Role;
}

export interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  pageSize: number;
}