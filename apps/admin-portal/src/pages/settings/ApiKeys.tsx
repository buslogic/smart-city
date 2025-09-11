import React, { useState, useRef } from 'react';
import { message } from 'antd';
import ApiKeysTable, { ApiKeysTableRef } from '../../components/api-keys/ApiKeysTable';
import CreateApiKeyModal from '../../components/api-keys/CreateApiKeyModal';
import EditApiKeyModal from '../../components/api-keys/EditApiKeyModal';
import RevokeApiKeyModal from '../../components/api-keys/RevokeApiKeyModal';
import AuditLogModal from '../../components/api-keys/AuditLogModal';
import { ApiKey } from '../../services/api-keys.service';

const ApiKeys: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [auditLogModalOpen, setAuditLogModalOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const tableRef = useRef<ApiKeysTableRef>(null);

  const handleCreateKey = () => {
    setCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    // Reload tabele nakon kreiranja
    tableRef.current?.reload();
  };

  const handleEditKey = (key: ApiKey) => {
    setSelectedApiKey(key);
    setEditModalOpen(true);
  };

  const handleViewAuditLog = (key: ApiKey) => {
    setSelectedApiKey(key);
    setAuditLogModalOpen(true);
  };

  const handleRevokeKey = (key: ApiKey) => {
    setSelectedApiKey(key);
    setRevokeModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedApiKey(null);
    tableRef.current?.reload();
    message.success('API ključ je uspešno ažuriran');
  };

  const handleRevokeSuccess = () => {
    setRevokeModalOpen(false);
    setSelectedApiKey(null);
    tableRef.current?.reload();
    message.success('API ključ je uspešno opozvan');
  };

  return (
    <div className="p-6 space-y-6">
      <ApiKeysTable
        ref={tableRef}
        onCreateKey={handleCreateKey}
        onEditKey={handleEditKey}
        onViewAuditLog={handleViewAuditLog}
        onRevokeKey={handleRevokeKey}
      />

      <CreateApiKeyModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <EditApiKeyModal
        open={editModalOpen}
        apiKey={selectedApiKey}
        onCancel={() => {
          setEditModalOpen(false);
          setSelectedApiKey(null);
        }}
        onSuccess={handleEditSuccess}
      />

      <RevokeApiKeyModal
        open={revokeModalOpen}
        apiKey={selectedApiKey}
        onCancel={() => {
          setRevokeModalOpen(false);
          setSelectedApiKey(null);
        }}
        onSuccess={handleRevokeSuccess}
      />

      <AuditLogModal
        open={auditLogModalOpen}
        apiKey={selectedApiKey}
        onCancel={() => {
          setAuditLogModalOpen(false);
          setSelectedApiKey(null);
        }}
      />
    </div>
  );
};

export default ApiKeys;