import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Input, message, Tooltip, Modal, Form, Select, Checkbox } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TableOutlined,
  LinkOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { usePermissions } from '../../../hooks/usePermissions';
import axios from 'axios';
import { TokenManager } from '../../../utils/token';

const { Search } = Input;
const { Option } = Select;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

interface LegacyDatabase {
  id: number;
  name: string;
  type: string;
}

interface TableMapping {
  id: number;
  legacyDatabaseId: number;
  legacyTableName: string;
  localTableName: string;
  mappingType: string;
  syncEnabled: boolean;
  syncFrequency?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  description?: string;
  legacyDatabase: LegacyDatabase;
}

const LegacyTableMappings: React.FC = () => {
  const [mappings, setMappings] = useState<TableMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TableMapping | null>(null);
  const [form] = Form.useForm();
  
  // For select dropdowns
  const [legacyDatabases, setLegacyDatabases] = useState<LegacyDatabase[]>([]);
  const [legacyTables, setLegacyTables] = useState<string[]>([]);
  const [localTables, setLocalTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('legacy_tables:create');
  const canUpdate = hasPermission('legacy_tables:update');
  const canDelete = hasPermission('legacy_tables:delete');

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${TokenManager.getAccessToken()}`,
    'Content-Type': 'application/json',
  });

  // Load mappings
  const loadMappings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/legacy-table-mappings`, {
        headers: getAuthHeaders(),
      });
      setMappings(response.data);
    } catch (error) {
      console.error('Error loading mappings:', error);
      message.error('Greška pri učitavanju mapiranja');
    } finally {
      setLoading(false);
    }
  };

  // Load legacy databases
  const loadLegacyDatabases = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/legacy-databases`, {
        headers: getAuthHeaders(),
      });
      setLegacyDatabases(response.data);
    } catch (error) {
      console.error('Error loading databases:', error);
    }
  };

  // Load legacy tables for selected database
  const loadLegacyTables = async (databaseId: number) => {
    try {
      setLoadingTables(true);
      const response = await axios.get(
        `${API_URL}/api/legacy-table-mappings/legacy-tables/${databaseId}`,
        { headers: getAuthHeaders() }
      );
      setLegacyTables(response.data);
    } catch (error) {
      console.error('Error loading legacy tables:', error);
      message.error('Greška pri učitavanju tabela iz legacy baze');
    } finally {
      setLoadingTables(false);
    }
  };

  // Load local tables
  const loadLocalTables = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/legacy-table-mappings/local-tables`,
        { headers: getAuthHeaders() }
      );
      setLocalTables(response.data);
    } catch (error) {
      console.error('Error loading local tables:', error);
    }
  };

  useEffect(() => {
    loadMappings();
    loadLegacyDatabases();
    loadLocalTables();
  }, []);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const filteredMappings = mappings.filter(m => 
    !searchTerm || 
    m.legacyTableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.localTableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.legacyDatabase.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setEditingMapping(null);
    form.resetFields();
    setLegacyTables([]);
    setModalVisible(true);
  };

  const handleEdit = (record: TableMapping) => {
    setEditingMapping(record);
    form.setFieldsValue(record);
    loadLegacyTables(record.legacyDatabaseId);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Potvrda brisanja',
      content: 'Da li ste sigurni da želite da obrišete ovo mapiranje?',
      okText: 'Da, obriši',
      cancelText: 'Otkaži',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`${API_URL}/api/legacy-table-mappings/${id}`, {
            headers: getAuthHeaders(),
          });
          message.success('Mapiranje je uspešno obrisano');
          await loadMappings();
        } catch (error) {
          console.error('Error deleting mapping:', error);
          message.error('Greška pri brisanju mapiranja');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingMapping) {
        await axios.patch(
          `${API_URL}/api/legacy-table-mappings/${editingMapping.id}`,
          values,
          { headers: getAuthHeaders() }
        );
        message.success('Mapiranje je uspešno ažurirano');
      } else {
        await axios.post(
          `${API_URL}/api/legacy-table-mappings`,
          values,
          { headers: getAuthHeaders() }
        );
        message.success('Novo mapiranje je uspešno kreirano');
      }
      
      setModalVisible(false);
      form.resetFields();
      await loadMappings();
    } catch (error) {
      console.error('Error saving mapping:', error);
      message.error('Greška pri čuvanju mapiranja');
    }
  };

  const columns: ColumnsType<TableMapping> = [
    {
      title: 'Legacy Baza',
      key: 'legacyDatabase',
      render: (_, record) => (
        <Tag color="blue">{record.legacyDatabase.name}</Tag>
      ),
    },
    {
      title: 'Legacy Tabela',
      dataIndex: 'legacyTableName',
      key: 'legacyTableName',
      render: (text) => (
        <span className="font-mono">{text}</span>
      ),
    },
    {
      title: 'Lokalna Tabela',
      dataIndex: 'localTableName',
      key: 'localTableName',
      render: (text) => (
        <span className="font-mono">{text}</span>
      ),
    },
    {
      title: 'Tip Mapiranja',
      dataIndex: 'mappingType',
      key: 'mappingType',
      render: (type: string) => {
        const colors: Record<string, string> = {
          one_way: 'green',
          two_way: 'orange',
          manual: 'gray',
        };
        const labels: Record<string, string> = {
          one_way: 'Jednosmerno',
          two_way: 'Dvosmerno',
          manual: 'Ručno',
        };
        return <Tag color={colors[type]}>{labels[type]}</Tag>;
      },
    },
    {
      title: 'Sinhronizacija',
      key: 'sync',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Tag color={record.syncEnabled ? 'green' : 'red'}>
            {record.syncEnabled ? 'Omogućena' : 'Onemogućena'}
          </Tag>
          {record.lastSyncAt && (
            <span className="text-xs text-gray-500">
              {new Date(record.lastSyncAt).toLocaleString('sr-RS')}
            </span>
          )}
        </Space>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Izmeni">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={!canUpdate}
            />
          </Tooltip>
          <Tooltip title="Obriši">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
              disabled={!canDelete}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Search
          placeholder="Pretraži mapiranja..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          style={{ maxWidth: 400 }}
          onSearch={handleSearch}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          disabled={!canCreate}
        >
          Novo Mapiranje
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredMappings}
        rowKey="id"
        loading={loading}
        className="bg-white rounded-lg shadow-sm"
      />

      {/* Modal za kreiranje/editovanje */}
      <Modal
        title={editingMapping ? 'Izmeni Mapiranje' : 'Novo Mapiranje Tabela'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            mappingType: 'one_way',
            syncEnabled: false,
          }}
        >
          <Form.Item
            name="legacyDatabaseId"
            label="Legacy Baza"
            rules={[{ required: true, message: 'Legacy baza je obavezna' }]}
          >
            <Select
              placeholder="Izaberite legacy bazu"
              onChange={(value) => {
                form.setFieldValue('legacyTableName', undefined);
                loadLegacyTables(value);
              }}
            >
              {legacyDatabases.map(db => (
                <Option key={db.id} value={db.id}>
                  {db.name} ({db.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="legacyTableName"
            label="Legacy Tabela"
            rules={[{ required: true, message: 'Legacy tabela je obavezna' }]}
          >
            <Select
              placeholder={loadingTables ? "Učitavanje..." : "Pretražite i izaberite legacy tabelu"}
              loading={loadingTables}
              disabled={!form.getFieldValue('legacyDatabaseId')}
              showSearch
              filterOption={(input, option) =>
                ((option as any)?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
              optionFilterProp="children"
            >
              {legacyTables.map(table => (
                <Option key={table} value={table}>
                  {table}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="localTableName"
            label="Lokalna Tabela"
            rules={[{ required: true, message: 'Lokalna tabela je obavezna' }]}
          >
            <Select 
              placeholder="Pretražite i izaberite lokalnu tabelu"
              showSearch
              filterOption={(input, option) =>
                ((option as any)?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
              optionFilterProp="children"
            >
              {localTables.map(table => (
                <Option key={table} value={table}>
                  {table}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="mappingType"
            label="Tip Mapiranja"
          >
            <Select>
              <Option value="one_way">Jednosmerno (Legacy → Lokalna)</Option>
              <Option value="two_way">Dvosmerno (Sinhronizacija)</Option>
              <Option value="manual">Ručno</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="syncEnabled"
            valuePropName="checked"
          >
            <Checkbox>Omogući automatsku sinhronizaciju</Checkbox>
          </Form.Item>

          <Form.Item
            name="description"
            label="Opis"
          >
            <Input.TextArea rows={2} placeholder="Opis mapiranja (opciono)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LegacyTableMappings;