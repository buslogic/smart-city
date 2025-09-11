import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Table, 
  Tag, 
  Typography,
  Empty,
  Spin
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Eye, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import { apiKeysService, type ApiKey, type ApiKeyLog } from '../../services/api-keys.service';

const { Text, Title } = Typography;

interface AuditLogModalProps {
  open: boolean;
  apiKey: ApiKey | null;
  onCancel: () => void;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({
  open,
  apiKey,
  onCancel,
}) => {
  const [auditLogs, setAuditLogs] = useState<ApiKeyLog[]>([]);
  const [loading, setLoading] = useState(false);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'key_created': return 'green';
      case 'key_updated': return 'blue';
      case 'key_revoked': return 'red';
      case 'key_used': return 'default';
      case 'key_failed': return 'orange';
      default: return 'default';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'key_created': return 'Kreiran';
      case 'key_updated': return 'Ažuriran';
      case 'key_revoked': return 'Opozvan';
      case 'key_used': return 'Korišćen';
      case 'key_failed': return 'Neuspešan poziv';
      default: return action;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'blue';
      case 'POST': return 'green';
      case 'PUT': 
      case 'PATCH': return 'orange';
      case 'DELETE': return 'red';
      default: return 'default';
    }
  };

  const getResponseColor = (code: number) => {
    if (code >= 200 && code < 300) return 'success';
    if (code >= 300 && code < 400) return 'warning';
    if (code >= 400) return 'error';
    return 'default';
  };

  const columns: ColumnsType<ApiKeyLog> = [
    {
      title: 'Akcija',
      dataIndex: 'action',
      key: 'action',
      render: (action) => (
        <Tag color={getActionColor(action)}>{getActionLabel(action)}</Tag>
      ),
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (endpoint, record) => (
        <div className="font-mono text-sm">
          <Tag color={getMethodColor(record.method)} size="small">
            {record.method}
          </Tag>
          <span className="ml-1">{endpoint}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'responseCode',
      key: 'responseCode',
      align: 'center',
      render: (code) => (
        <Tag color={getResponseColor(code)}>{code}</Tag>
      ),
    },
    {
      title: 'Vreme',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt) => (
        <div>
          <div className="text-sm">
            {formatDistanceToNow(new Date(createdAt), { 
              addSuffix: true, 
              locale: sr 
            })}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(createdAt).toLocaleString('sr-RS')}
          </div>
        </div>
      ),
    },
  ];

  const loadAuditLogs = async () => {
    if (!apiKey) return;

    setLoading(true);
    try {
      const logs = await apiKeysService.getAuditLog(apiKey.id, 100);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Greška pri učitavanju audit log-a:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && apiKey) {
      loadAuditLogs();
    }
  }, [open, apiKey]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SWAGGER_ACCESS': return 'Swagger Access';
      case 'API_ACCESS': return 'API Access';
      case 'ADMIN_ACCESS': return 'Admin Access';
      case 'INTEGRATION': return 'Integration';
      default: return type;
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Audit Log - API Ključ
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1000}
    >
      <div className="space-y-4">
        {apiKey && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Title level={5} className="mb-1">{apiKey.name}</Title>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Tip: {getTypeLabel(apiKey.type)} | Ključ: ...{apiKey.displayKey}</div>
                  <div>Ukupno korišćenja: {apiKey.usageCount}</div>
                  <div>Poslednje korišćenje: {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString('sr-RS') : 'Nikad'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <Text type="secondary">{auditLogs.length} unosa</Text>
              </div>
            </div>
          </div>
        )}

        <div>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={auditLogs}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} od ${total} unosa`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Nema zabeleženih aktivnosti"
                  />
                ),
              }}
              size="small"
            />
          </Spin>
        </div>
      </div>
    </Modal>
  );
};

export default AuditLogModal;