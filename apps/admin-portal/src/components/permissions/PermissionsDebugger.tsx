import React, { useEffect } from 'react';
import { FloatButton, Badge, Tooltip, Modal, Tabs, Input, Select, Tag, Space, Spin, Alert, Divider, Progress, Card, Empty, Typography } from 'antd';
import { 
  ShieldCheck, 
  Shield, 
  Lock, 
  Unlock, 
  Search,
  X,
  Check,
  AlertTriangle,
  Info,
  FileText,
  User,
  Key
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { usePermissionsDebuggerStore } from '../../stores/permissions-debugger.store';
import type { UserPermissionStatus, PermissionDetail } from '../../types/permissions-debugger';

const { Title, Text, Paragraph } = Typography;

const PermissionsDebugger: React.FC = () => {
  const location = useLocation();
  const {
    isOpen,
    isEnabled,
    debugInfo,
    loading,
    error,
    activeTab,
    searchQuery,
    selectedCategory,
    setOpen,
    setActiveTab,
    setSearchQuery,
    setSelectedCategory,
    fetchDebugInfo,
  } = usePermissionsDebuggerStore();

  // Fetch debug info when modal opens or route changes
  useEffect(() => {
    if (isOpen) {
      fetchDebugInfo(location.pathname);
    }
  }, [isOpen, location.pathname]);

  if (!isEnabled) {
    return null;
  }

  // Calculate badge count
  const getBadgeCount = () => {
    if (!debugInfo?.currentRoutePermissions) return 0;
    const required = debugInfo.currentRoutePermissions.required.filter(p => !p.hasAccess).length;
    const optional = debugInfo.currentRoutePermissions.optional.filter(p => !p.hasAccess).length;
    return required + optional;
  };

  // Get badge status color
  const getBadgeStatus = () => {
    if (!debugInfo?.currentRoutePermissions) return 'default';
    const missingRequired = debugInfo.currentRoutePermissions.required.filter(p => !p.hasAccess).length;
    if (missingRequired > 0) return 'error';
    const missingOptional = debugInfo.currentRoutePermissions.optional.filter(p => !p.hasAccess).length;
    if (missingOptional > 0) return 'warning';
    return 'success';
  };

  const renderPermissionItem = (perm: UserPermissionStatus) => (
    <div key={perm.permission} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
      <div className="flex items-center gap-2">
        {perm.hasAccess ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <X className="w-4 h-4 text-red-500" />
        )}
        <div>
          <Text strong={!perm.hasAccess} type={perm.hasAccess ? undefined : 'danger'}>
            {perm.permission}
          </Text>
          {perm.descriptionSr && (
            <div>
              <Text type="secondary" className="text-xs">
                {perm.descriptionSr}
              </Text>
            </div>
          )}
        </div>
      </div>
      <Tag color={perm.hasAccess ? 'success' : 'error'}>
        {perm.hasAccess ? 'IMA' : 'NEMA'}
      </Tag>
    </div>
  );

  const renderCurrentRouteTab = () => {
    if (!debugInfo?.currentRoutePermissions) {
      return (
        <Empty 
          description="Nema konfiguracije permisija za ovu rutu"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    const { required, optional } = debugInfo.currentRoutePermissions;
    const allRequired = required.every(p => p.hasAccess);
    const allOptional = optional.every(p => p.hasAccess);

    return (
      <div className="space-y-4">
        <Alert
          message={`Ruta: ${location.pathname}`}
          type="info"
          showIcon
          icon={<FileText className="w-4 h-4" />}
        />

        {/* Required Permissions */}
        <Card size="small" title={
          <Space>
            <Lock className="w-4 h-4" />
            <span>Obavezne permisije ({required.filter(p => p.hasAccess).length}/{required.length})</span>
          </Space>
        }>
          {required.length > 0 ? (
            <>
              <Progress 
                percent={Math.round((required.filter(p => p.hasAccess).length / required.length) * 100)}
                status={allRequired ? 'success' : 'exception'}
                className="mb-3"
              />
              {required.map(renderPermissionItem)}
            </>
          ) : (
            <Text type="secondary">Nema obaveznih permisija</Text>
          )}
        </Card>

        {/* Optional Permissions */}
        <Card size="small" title={
          <Space>
            <Unlock className="w-4 h-4" />
            <span>Opcione permisije ({optional.filter(p => p.hasAccess).length}/{optional.length})</span>
          </Space>
        }>
          {optional.length > 0 ? (
            <>
              <Progress 
                percent={Math.round((optional.filter(p => p.hasAccess).length / optional.length) * 100)}
                status={allOptional ? 'success' : 'active'}
                className="mb-3"
              />
              {optional.map(renderPermissionItem)}
            </>
          ) : (
            <Text type="secondary">Nema opcionih permisija</Text>
          )}
        </Card>
      </div>
    );
  };

  const renderAllPermissionsTab = () => {
    if (!debugInfo) return null;

    const categories = Object.keys(debugInfo.permissionsByCategory);
    const filteredCategories = selectedCategory 
      ? [selectedCategory]
      : categories;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Pretraži permisije..."
            prefix={<Search className="w-4 h-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select
            placeholder="Kategorija"
            value={selectedCategory}
            onChange={setSelectedCategory}
            className="w-48"
            allowClear
          >
            {categories.map(cat => (
              <Select.Option key={cat} value={cat}>{cat}</Select.Option>
            ))}
          </Select>
        </div>

        {filteredCategories.map(category => {
          const permissions = debugInfo.permissionsByCategory[category];
          const filtered = permissions.filter(p => 
            !searchQuery || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.descriptionSr?.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (filtered.length === 0) return null;

          return (
            <Card key={category} size="small" title={category}>
              <div className="space-y-1">
                {filtered.map(perm => {
                  const hasAccess = debugInfo.userPermissions.includes(perm.name);
                  return (
                    <div key={perm.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        {hasAccess ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-400" />
                        )}
                        <div>
                          <Text type={hasAccess ? undefined : 'secondary'}>
                            {perm.name}
                          </Text>
                          {perm.descriptionSr && (
                            <div>
                              <Text type="secondary" className="text-xs">
                                {perm.descriptionSr}
                              </Text>
                            </div>
                          )}
                        </div>
                      </div>
                      <Space>
                        <Tag>{perm.resource}:{perm.action}</Tag>
                        <Tag color={hasAccess ? 'success' : 'default'}>
                          {hasAccess ? 'IMA' : 'NEMA'}
                        </Tag>
                      </Space>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderMissingPermissionsTab = () => {
    if (!debugInfo) return null;

    const allPermissions = Object.values(debugInfo.permissionsByCategory).flat();
    const missingPermissions = allPermissions.filter(p => 
      !debugInfo.userPermissions.includes(p.name)
    );

    const groupedByCategory = missingPermissions.reduce((acc, perm) => {
      const category = perm.category || 'Ostalo';
      if (!acc[category]) acc[category] = [];
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, PermissionDetail[]>);

    return (
      <div className="space-y-4">
        <Alert
          message={`Nemate ${missingPermissions.length} od ukupno ${allPermissions.length} permisija`}
          type="warning"
          showIcon
        />

        {Object.entries(groupedByCategory).map(([category, perms]) => (
          <Card key={category} size="small" title={category}>
            <div className="space-y-1">
              {perms.map(perm => (
                <div key={perm.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-orange-500" />
                    <div>
                      <Text>{perm.name}</Text>
                      {perm.descriptionSr && (
                        <div>
                          <Text type="secondary" className="text-xs">
                            {perm.descriptionSr}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                  <Tag color="orange">{perm.resource}:{perm.action}</Tag>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderRoutesTab = () => {
    if (!debugInfo) return null;

    return (
      <div className="space-y-2">
        {debugInfo.routePermissions.map(route => {
          const isCurrent = route.route === location.pathname;
          return (
            <Card 
              key={route.route} 
              size="small" 
              className={isCurrent ? 'border-blue-500' : ''}
              title={
                <Space>
                  <FileText className="w-4 h-4" />
                  <Text strong={isCurrent}>{route.route}</Text>
                  {isCurrent && <Tag color="blue">TRENUTNA</Tag>}
                </Space>
              }
            >
              <div className="space-y-2">
                {route.requiredPermissions.length > 0 && (
                  <div>
                    <Text type="secondary" className="text-xs">Obavezne:</Text>
                    <Space wrap>
                      {route.requiredPermissions.map(perm => {
                        const hasAccess = debugInfo.userPermissions.includes(perm);
                        return (
                          <Tag 
                            key={perm} 
                            color={hasAccess ? 'success' : 'error'}
                            icon={hasAccess ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          >
                            {perm}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                )}
                {route.optionalPermissions && route.optionalPermissions.length > 0 && (
                  <div>
                    <Text type="secondary" className="text-xs">Opcione:</Text>
                    <Space wrap>
                      {route.optionalPermissions.map(perm => {
                        const hasAccess = debugInfo.userPermissions.includes(perm);
                        return (
                          <Tag 
                            key={perm} 
                            color={hasAccess ? 'success' : 'default'}
                            icon={hasAccess ? <Check className="w-3 h-3" /> : null}
                          >
                            {perm}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const tabs = [
    {
      key: 'current',
      label: 'Trenutna stranica',
      children: renderCurrentRouteTab(),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      key: 'all',
      label: `Sve permisije (${debugInfo?.stats.userPermissionsCount}/${debugInfo?.stats.totalPermissions})`,
      children: renderAllPermissionsTab(),
      icon: <Shield className="w-4 h-4" />,
    },
    {
      key: 'missing',
      label: 'Nedostupne',
      children: renderMissingPermissionsTab(),
      icon: <Lock className="w-4 h-4" />,
    },
    {
      key: 'routes',
      label: 'Rute',
      children: renderRoutesTab(),
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  return (
    <>
      <Tooltip title="Permissions Debugger" placement="left">
        <Badge count={getBadgeCount()} status={getBadgeStatus()}>
          <FloatButton
            icon={<Shield className="w-5 h-5" />}
            type="primary"
            onClick={() => setOpen(true)}
            style={{ 
              right: 24, 
              bottom: 24,
              width: 56,
              height: 56,
            }}
          />
        </Badge>
      </Tooltip>

      <Modal
        title={
          <Space>
            <ShieldCheck className="w-5 h-5" />
            <span>Permissions Debugger</span>
            {debugInfo && (
              <Tag color="blue">{debugInfo.user.email}</Tag>
            )}
          </Space>
        }
        open={isOpen}
        onCancel={() => setOpen(false)}
        width={900}
        footer={null}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Spin size="large" tip="Učitavanje..." />
          </div>
        )}

        {error && (
          <Alert
            message="Greška"
            description={error}
            type="error"
            showIcon
            className="mb-4"
          />
        )}

        {debugInfo && !loading && (
          <>
            {/* User Info Bar */}
            <div className="bg-gray-50 p-3 rounded mb-4">
              <div className="flex justify-between items-center">
                <Space>
                  <User className="w-4 h-4" />
                  <Text strong>{debugInfo.user.email}</Text>
                  <Divider type="vertical" />
                  <Text>Role:</Text>
                  {debugInfo.user.roles.map(role => (
                    <Tag key={role} color="blue">{role}</Tag>
                  ))}
                </Space>
                <Space>
                  <Progress
                    type="circle"
                    percent={debugInfo.stats.coverage}
                    size={50}
                    format={(percent) => `${percent}%`}
                  />
                  <div>
                    <Text type="secondary" className="text-xs">Pokrivenost</Text>
                    <div>
                      <Text strong>{debugInfo.stats.userPermissionsCount}/{debugInfo.stats.totalPermissions}</Text>
                    </div>
                  </div>
                </Space>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as any)}
              items={tabs}
            />
          </>
        )}
      </Modal>
    </>
  );
};

export default PermissionsDebugger;