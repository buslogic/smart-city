export interface RoutePermission {
  route: string;
  requiredPermissions: string[];
  optionalPermissions?: string[];
}

export interface PermissionDetail {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  descriptionSr?: string;
  category?: string;
  uiRoute?: string;
  requiredFor?: string[];
}

export interface UserPermissionStatus {
  permission: string;
  hasAccess: boolean;
  description?: string;
  descriptionSr?: string;
}

export interface PermissionDebugInfo {
  user: {
    id: number;
    email: string;
    roles: string[];
  };
  userPermissions: string[];
  permissionsByCategory: Record<string, PermissionDetail[]>;
  routePermissions: RoutePermission[];
  currentRoutePermissions?: {
    route: string;
    required: UserPermissionStatus[];
    optional: UserPermissionStatus[];
  };
  stats: {
    totalPermissions: number;
    userPermissionsCount: number;
    coverage: number;
  };
}

export interface PermissionsDebuggerState {
  isOpen: boolean;
  isEnabled: boolean;
  debugInfo: PermissionDebugInfo | null;
  loading: boolean;
  error: string | null;
  activeTab: 'current' | 'all' | 'missing' | 'routes';
  searchQuery: string;
  selectedCategory: string | null;
}