import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Button, Tag, Space, Modal, message, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Key, 
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import { apiKeysService, type ApiKey } from '../../services/api-keys.service';

interface ApiKeysTableProps {
  onCreateKey: () => void;
  onEditKey: (key: ApiKey) => void;
  onViewAuditLog: (key: ApiKey) => void;
  onRevokeKey: (key: ApiKey) => void;
}

export interface ApiKeysTableRef {
  reload: () => void;
}

const ApiKeysTable = forwardRef<ApiKeysTableRef, ApiKeysTableProps>(({
  onCreateKey,
  onEditKey,
  onViewAuditLog,
  onRevokeKey,
}, ref) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SWAGGER_ACCESS': return 'blue';
      case 'API_ACCESS': return 'green';
      case 'ADMIN_ACCESS': return 'red';
      case 'INTEGRATION': return 'orange';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SWAGGER_ACCESS': return 'Swagger';
      case 'API_ACCESS': return 'API';
      case 'ADMIN_ACCESS': return 'Admin';
      case 'INTEGRATION': return 'Integracija';
      default: return type;
    }
  };

  const getStatusColor = (key: ApiKey) => {
    if (!key.isActive || key.revokedAt) return 'red';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'orange';
    return 'green';
  };

  const getStatusText = (key: ApiKey) => {
    if (!key.isActive || key.revokedAt) return 'Opozvan';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'Istekao';
    return 'Aktivan';
  };

  const getStatusIcon = (key: ApiKey) => {
    if (!key.isActive || key.revokedAt) return <AlertCircle className="w-3 h-3" />;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return <Calendar className="w-3 h-3" />;
    return <CheckCircle className="w-3 h-3" />;
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center space-x-2">
          <Key className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-gray-500">...{record.displayKey}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tip',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={getTypeColor(type)}>{getTypeLabel(type)}</Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Tag 
          color={getStatusColor(record)} 
          icon={getStatusIcon(record)}
        >
          {getStatusText(record)}
        </Tag>
      ),
    },
    {
      title: 'Vlasnik',
      dataIndex: 'creator',
      key: 'creator',
      render: (creator) => (
        <div>
          <div className="font-medium">{creator.firstName} {creator.lastName}</div>
          <div className="text-xs text-gray-500">{creator.email}</div>
        </div>
      ),
    },
    {
      title: 'Poslednje korišćenje',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (lastUsedAt, record) => (
        <div>
          {lastUsedAt ? (
            <div>
              <div className="text-sm">
                {formatDistanceToNow(new Date(lastUsedAt), { 
                  addSuffix: true, 
                  locale: sr 
                })}
              </div>
              {record.lastUsedIp && (
                <div className="text-xs text-gray-500">{record.lastUsedIp}</div>
              )}
            </div>
          ) : (
            <span className="text-gray-400">Nikad</span>
          )}
        </div>
      ),
    },
    {
      title: 'Korišćenja',
      dataIndex: 'usageCount',
      key: 'usageCount',
      align: 'center',
      render: (count) => (
        <div className="flex items-center justify-center space-x-1">
          <Activity className="w-3 h-3 text-gray-400" />
          <span>{count}</span>
        </div>
      ),
    },
    {
      title: 'Ističe',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (expiresAt) => (
        expiresAt ? (
          <div className="text-sm">
            {formatDistanceToNow(new Date(expiresAt), { 
              addSuffix: true, 
              locale: sr 
            })}
          </div>
        ) : (
          <span className="text-gray-400">Nikad</span>
        )
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="Pregled audit log-a">
            <Button
              type="text"
              size="small"
              icon={<Eye className="w-4 h-4" />}
              onClick={() => onViewAuditLog(record)}
            />
          </Tooltip>
          
          <Tooltip title="Izmena">
            <Button
              type="text"
              size="small"
              icon={<Edit className="w-4 h-4" />}
              onClick={() => onEditKey(record)}
              disabled={!record.isActive || !!record.revokedAt}
            />
          </Tooltip>
          
          <Tooltip title="Opozovi ključ">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => onRevokeKey(record)}
              disabled={!record.isActive || !!record.revokedAt}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const loadApiKeys = async () => {
    setLoading(true);
    try {
      const keys = await apiKeysService.getAll();
      setApiKeys(keys);
    } catch (error) {
      console.error('Greška pri učitavanju API ključeva:', error);
      message.error('Greška pri učitavanju API ključeva');
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    reload: loadApiKeys,
  }));

  useEffect(() => {
    loadApiKeys();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upravljanje pristupnim ključevima za API
            </p>
          </div>
          <Button 
            type="primary" 
            icon={<Plus className="w-4 h-4" />}
            onClick={onCreateKey}
          >
            Novi ključ
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Table
          columns={columns}
          dataSource={apiKeys}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} od ${total} ključeva`,
          }}
          locale={{
            emptyText: 'Nema kreiranih API ključeva',
          }}
        />
      </div>
    </div>
  );
});

ApiKeysTable.displayName = 'ApiKeysTable';

export default ApiKeysTable;