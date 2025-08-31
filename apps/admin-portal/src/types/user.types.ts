export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: string[]; // Sada je array stringova umesto objekata
  permissions?: string[]; // Dodato i permissions
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