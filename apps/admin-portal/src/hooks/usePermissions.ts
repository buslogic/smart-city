import { useAuthStore } from '../stores/auth.store';

export const usePermissions = () => {
  const { checkPermission, hasRole, user } = useAuthStore();

  const canAccess = (permissions: string[] = [], roles: string[] = [], requireAll = false) => {
    // Super admin ima pristup svemu
    if (user?.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    // Proverava permisije
    const hasRequiredPermissions = permissions.length === 0 || (
      requireAll 
        ? permissions.every(permission => checkPermission(permission))
        : permissions.some(permission => checkPermission(permission))
    );

    // Proverava uloge
    const hasRequiredRoles = roles.length === 0 || (
      requireAll 
        ? roles.every(role => hasRole(role))
        : roles.some(role => hasRole(role))
    );

    return hasRequiredPermissions && hasRequiredRoles;
  };

  const canCreateUsers = () => canAccess(['users:create']);
  const canReadUsers = () => canAccess(['users:read']);
  const canUpdateUsers = () => canAccess(['users:update']);
  const canDeleteUsers = () => canAccess(['users:delete']);
  const canManageUsers = () => canAccess(['users:manage']);

  const canCreateRoles = () => canAccess(['roles:create']);
  const canReadRoles = () => canAccess(['roles:read']);
  const canUpdateRoles = () => canAccess(['roles:update']);
  const canDeleteRoles = () => canAccess(['roles:delete']);
  const canManageRoles = () => canAccess(['roles:manage']);

  const hasPermission = (permission: string) => {
    // Super admin ima pristup svemu
    if (user?.roles?.includes('SUPER_ADMIN')) {
      return true;
    }
    return checkPermission(permission);
  };

  return {
    canAccess,
    canCreateUsers,
    canReadUsers,
    canUpdateUsers,
    canDeleteUsers,
    canManageUsers,
    canCreateRoles,
    canReadRoles,
    canUpdateRoles,
    canDeleteRoles,
    canManageRoles,
    user,
    checkPermission,
    hasRole,
    hasPermission,
  };
};