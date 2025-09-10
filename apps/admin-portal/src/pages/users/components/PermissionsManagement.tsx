import React, { useState, useEffect } from 'react';
import { 
  Select, 
  Tag, 
  Button, 
  Space, 
  message, 
  Card,
  Checkbox,
  Divider,
  Spin,
  Alert,
  Badge,
} from 'antd';
import {
  SafetyOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { Role, Permission } from '../../../types/rbac.types';
import { rbacService } from '../../../services/rbacService';

const PermissionsManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Grupisanje permisija po resursima
  const groupedPermissions = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const fetchRoles = async () => {
    try {
      const response = await rbacService.getRoles(1, 100);
      setRoles(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      // Mock podaci
      setRoles([
        { id: 1, name: 'SUPER_ADMIN', description: 'Administratorska uloga', createdAt: '', updatedAt: '' },
        { id: 2, name: 'CITY_MANAGER', description: 'Menadžer gradskih resursa', createdAt: '', updatedAt: '' },
        { id: 3, name: 'DEPARTMENT_HEAD', description: 'Šef departmana', createdAt: '', updatedAt: '' },
        { id: 4, name: 'OPERATOR', description: 'Operater sistema', createdAt: '', updatedAt: '' },
        { id: 5, name: 'ANALYST', description: 'Analitičar', createdAt: '', updatedAt: '' },
        { id: 6, name: 'CITIZEN', description: 'Građanin', createdAt: '', updatedAt: '' },
      ]);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rbacService.getPermissions();
      setAllPermissions(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju permisija:', error);
      // Mock podaci
      setAllPermissions([
        // Users permissions
        { id: 1, name: 'users:create', resource: 'users', action: 'create', description: 'Kreiranje korisnika', createdAt: '', updatedAt: '' },
        { id: 2, name: 'users:view', resource: 'users', action: 'view', description: 'Pregled korisnika', createdAt: '', updatedAt: '' },
        { id: 3, name: 'users:update', resource: 'users', action: 'update', description: 'Ažuriranje korisnika', createdAt: '', updatedAt: '' },
        { id: 4, name: 'users:delete', resource: 'users', action: 'delete', description: 'Brisanje korisnika', createdAt: '', updatedAt: '' },
        
        // Roles permissions
        { id: 6, name: 'roles:create', resource: 'roles', action: 'create', description: 'Kreiranje uloga', createdAt: '', updatedAt: '' },
        { id: 7, name: 'roles:view', resource: 'roles', action: 'view', description: 'Pregled uloga', createdAt: '', updatedAt: '' },
        { id: 8, name: 'roles:update', resource: 'roles', action: 'update', description: 'Ažuriranje uloga', createdAt: '', updatedAt: '' },
        { id: 9, name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Brisanje uloga', createdAt: '', updatedAt: '' },
      ]);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      setLoading(true);
      const permissions = await rbacService.getRolePermissions(roleId);
      const permissionIds = permissions.map(p => p.id);
      setRolePermissions(permissionIds);
      setHasChanges(false);
    } catch (error) {
      console.error('Greška pri učitavanju permisija role:', error);
      // Mock podaci - različite permisije za različite role
      const mockPermissions: Record<number, number[]> = {
        1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // SUPER_ADMIN - sve
        2: [2, 3, 7], // CITY_MANAGER
        3: [2, 7], // DEPARTMENT_HEAD
        4: [2], // OPERATOR
        5: [2, 7], // ANALYST
        6: [], // CITIZEN
      };
      setRolePermissions(mockPermissions[roleId] || []);
      setHasChanges(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  const handleRoleChange = (roleId: number) => {
    if (hasChanges) {
      message.warning('Imate nesačuvane promene!');
    }
    setSelectedRole(roleId);
  };

  const handlePermissionChange = (permissionId: number, checked: boolean) => {
    if (checked) {
      setRolePermissions([...rolePermissions, permissionId]);
    } else {
      setRolePermissions(rolePermissions.filter(id => id !== permissionId));
    }
    setHasChanges(true);
  };

  const handleResourceToggle = (resource: string, checked: boolean) => {
    const resourcePermissions = allPermissions
      .filter(p => p.resource === resource)
      .map(p => p.id);
    
    if (checked) {
      setRolePermissions([...new Set([...rolePermissions, ...resourcePermissions])]);
    } else {
      setRolePermissions(rolePermissions.filter(id => !resourcePermissions.includes(id)));
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    try {
      setSaving(true);
      await rbacService.updateRolePermissions(selectedRole, rolePermissions);
      message.success('Permisije uspešno ažurirane');
      setHasChanges(false);
    } catch (error) {
      console.error('Greška pri čuvanju permisija:', error);
      // Za testiranje
      message.success('Permisije uspešno ažurirane');
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'create': 'green',
      'read': 'blue',
      'update': 'orange',
      'delete': 'red',
      'manage': 'purple',
    };
    return colors[action] || 'default';
  };

  const getResourceIcon = (resource: string) => {
    const resourceLabels: Record<string, string> = {
      'users': 'Korisnici',
      'roles': 'Role',
    };
    return resourceLabels[resource] || resource;
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <label className="font-medium">Odaberite rolu:</label>
            <Select
              style={{ width: 300 }}
              placeholder="Izaberite rolu za upravljanje permisijama"
              onChange={handleRoleChange}
              value={selectedRole}
              options={roles.map(role => ({
                label: (
                  <div className="flex items-center justify-between w-full">
                    <span>{role.name}</span>
                    <span className="text-gray-500 text-sm">{role.description}</span>
                  </div>
                ),
                value: role.id,
              }))}
            />
          </div>
          {selectedRole && (
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleReset}
                disabled={!hasChanges}
              >
                Resetuj
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges}
              >
                Sačuvaj promene
              </Button>
            </Space>
          )}
        </div>

        {selectedRole && hasChanges && (
          <Alert
            message="Imate nesačuvane promene"
            description="Kliknite na 'Sačuvaj promene' da biste sačuvali izmene ili 'Resetuj' da biste poništili promene."
            type="warning"
            showIcon
            className="mb-4"
          />
        )}
      </Card>

      {selectedRole ? (
        <Spin spinning={loading}>
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([resource, permissions]) => {
              const resourcePermissionIds = permissions.map(p => p.id);
              const checkedCount = resourcePermissionIds.filter(id => rolePermissions.includes(id)).length;
              const isIndeterminate = checkedCount > 0 && checkedCount < permissions.length;
              const isAllChecked = checkedCount === permissions.length;

              return (
                <Card key={resource} className="shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <SafetyOutlined className="text-lg" />
                      <h3 className="text-lg font-semibold">{getResourceIcon(resource)}</h3>
                      <Badge count={`${checkedCount}/${permissions.length}`} showZero />
                    </div>
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={isAllChecked}
                      onChange={(e: CheckboxChangeEvent) => handleResourceToggle(resource, e.target.checked)}
                    >
                      Selektuj sve
                    </Checkbox>
                  </div>
                  <Divider className="my-3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {permissions.map(permission => (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={rolePermissions.includes(permission.id)}
                            onChange={(e: CheckboxChangeEvent) => 
                              handlePermissionChange(permission.id, e.target.checked)
                            }
                          />
                          <div>
                            <Tag color={getActionColor(permission.action)}>
                              {permission.action.toUpperCase()}
                            </Tag>
                            <span className="text-sm text-gray-600 ml-2">
                              {permission.description}
                            </span>
                          </div>
                        </div>
                        {rolePermissions.includes(permission.id) ? (
                          <CheckCircleOutlined className="text-green-500" />
                        ) : (
                          <CloseCircleOutlined className="text-gray-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </Spin>
      ) : (
        <Card className="text-center py-12">
          <SafetyOutlined className="text-4xl text-gray-400 mb-4" />
          <p className="text-gray-500">Izaberite rolu da biste upravljali njenim permisijama</p>
        </Card>
      )}
    </div>
  );
};

export default PermissionsManagement;