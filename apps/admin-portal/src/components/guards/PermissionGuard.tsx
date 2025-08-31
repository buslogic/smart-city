import React, { ReactNode } from 'react';
import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth.store';

interface PermissionGuardProps {
  children: ReactNode;
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean; // Da li su potrebne sve permisije/uloge ili samo jedna
  fallback?: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  fallback,
}) => {
  const { checkPermission, hasRole, user } = useAuthStore();

  // Proverava permisije
  const hasRequiredPermissions = () => {
    if (permissions.length === 0) return true;

    if (requireAll) {
      return permissions.every(permission => checkPermission(permission));
    } else {
      return permissions.some(permission => checkPermission(permission));
    }
  };

  // Proverava uloge
  const hasRequiredRoles = () => {
    if (roles.length === 0) return true;

    if (requireAll) {
      return roles.every(role => hasRole(role));
    } else {
      return roles.some(role => hasRole(role));
    }
  };

  // Super admin ima pristup svemu
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

  const hasAccess = isSuperAdmin || (hasRequiredPermissions() && hasRequiredRoles());

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Result
        status="403"
        title="403"
        subTitle="Nemate dozvolu za pristup ovoj stranici."
        icon={<LockOutlined />}
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            Nazad
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};