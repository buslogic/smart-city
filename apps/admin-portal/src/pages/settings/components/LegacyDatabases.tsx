import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Input, message, Tooltip, Switch, Modal, Form, Select } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { usePermissions } from '../../../hooks/usePermissions';
import { 
  legacyDatabasesService, 
  type LegacyDatabase as ApiLegacyDatabase,
  type CreateLegacyDatabaseDto,
  type UpdateLegacyDatabaseDto,
  LEGACY_DATABASE_SUBTYPES,
  SUBTYPE_LABELS,
  SUBTYPE_DESCRIPTIONS
} from '../../../services/legacyDatabases.service';

const { Search } = Input;
const { Option } = Select;

// Using interface from service
type LegacyDatabase = ApiLegacyDatabase;

const LegacyDatabases: React.FC = () => {
  const [databases, setDatabases] = useState<LegacyDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDatabase, setEditingDatabase] = useState<LegacyDatabase | null>(null);
  const [form] = Form.useForm();
  
  // Test connection modal state
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testedDatabase, setTestedDatabase] = useState<LegacyDatabase | null>(null);
  
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('legacy_databases:create');
  const canUpdate = hasPermission('legacy_databases:update');
  const canDelete = hasPermission('legacy_databases:delete');

  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total) => `Ukupno ${total} baza`,
  });

  // Load databases from API
  const loadDatabases = async () => {
    try {
      setLoading(true);
      const data = await legacyDatabasesService.getAll();
      setDatabases(data);
    } catch (error) {
      console.error('Error loading databases:', error);
      message.error('Greška pri učitavanju baza podataka');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  // Filter databases based on search term
  const filteredDatabases = databases.filter(db => 
    !searchTerm || 
    db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.database.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setEditingDatabase(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: LegacyDatabase) => {
    setEditingDatabase(record);
    form.setFieldsValue({
      ...record,
      password: '' // Don't populate password field for security
    });
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Potvrda brisanja',
      content: 'Da li ste sigurni da želite da obrišete ovu konfiguraciju baze?',
      okText: 'Da, obriši',
      cancelText: 'Otkaži',
      okType: 'danger',
      onOk: async () => {
        try {
          await legacyDatabasesService.delete(id);
          message.success('Konfiguracija baze je uspešno obrisana');
          await loadDatabases(); // Reload data
        } catch (error) {
          console.error('Error deleting database:', error);
          message.error('Greška pri brisanju baze podataka');
        }
      },
    });
  };

  const handleTestConnection = async (record: LegacyDatabase) => {
    const hide = message.loading(`Testiram konekciju na bazu "${record.name}"...`, 0);
    
    try {
      const result = await legacyDatabasesService.testConnection(record.id);
      hide();
      
      // Set state for our custom modal
      setTestResult(result);
      setTestedDatabase(record);
      setTestModalVisible(true);
      
    } catch (error: any) {
      hide();
      message.error(`Greška pri testiranju konekcije: ${error.message}`);
    }
  };

  const handleToggleStatus = async (id: number, checked: boolean) => {
    try {
      await legacyDatabasesService.update(id, { isActive: checked });
      message.success(`Baza ${checked ? 'aktivirana' : 'deaktivirana'}`);
      await loadDatabases(); // Reload data
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Greška pri ažuriranju statusa baze');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingDatabase) {
        // Update - only send fields that have values
        const updateData: UpdateLegacyDatabaseDto = {};
        Object.keys(values).forEach(key => {
          if (values[key] !== undefined && values[key] !== '') {
            (updateData as any)[key] = values[key];
          }
        });
        
        await legacyDatabasesService.update(editingDatabase.id, updateData);
        message.success('Konfiguracija baze je uspešno ažurirana');
      } else {
        // Create
        await legacyDatabasesService.create(values as CreateLegacyDatabaseDto);
        message.success('Nova konfiguracija baze je uspešno kreirana');
      }
      
      setModalVisible(false);
      form.resetFields();
      await loadDatabases(); // Reload data
    } catch (error) {
      console.error('Error saving database:', error);
      message.error('Greška pri čuvanju konfiguracije baze');
    }
  };

  const columns: ColumnsType<LegacyDatabase> = [
    {
      title: 'Naziv Konekcije',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.description && (
            <div className="text-gray-500 text-sm">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tip',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: 'mysql' | 'postgresql' | 'mongodb' | 'oracle' | 'mssql') => {
        const colors: Record<string, string> = {
          mysql: 'blue',
          postgresql: 'green',
          mongodb: 'orange',
          oracle: 'red',
          mssql: 'purple',
        };
        return <Tag color={colors[type]}>{type.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Podvrsta',
      dataIndex: 'subtype',
      key: 'subtype',
      width: 180,
      render: (subtype) => {
        if (!subtype) return <span className="text-gray-400">-</span>;
        
        const colors: Record<string, string> = {
          [LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]: 'volcano',
          [LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]: 'geekblue',
          [LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]: 'purple',
          [LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]: 'cyan',
        };
        
        return (
          <Tag color={colors[subtype] || 'default'}>
            {(SUBTYPE_LABELS as Record<string, string>)[subtype] || subtype}
          </Tag>
        );
      },
    },
    {
      title: 'Konekcija',
      key: 'connection',
      render: (_, record) => (
        <div className="text-sm">
          <div>{record.host}:{record.port}</div>
          <div className="text-gray-500">{record.database}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleStatus(record.id, checked)}
          disabled={!canUpdate}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      ),
    },
    {
      title: 'Test Konekcije',
      key: 'testConnection',
      align: 'center',
      render: (_, record) => (
        <div>
          <Tag 
            color={record.testConnection ? 'green' : 'red'}
            icon={record.testConnection ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          >
            {record.testConnection ? 'Uspešna' : 'Neuspešna'}
          </Tag>
          {record.lastConnectionTest && (
            <div className="text-xs text-gray-500 mt-1">
              {new Date(record.lastConnectionTest).toLocaleString('sr-RS')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Test konekcije">
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => handleTestConnection(record)}
            />
          </Tooltip>
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
      {/* Legenda za podvrste */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold mb-3 text-blue-900">Legenda - Podvrste Legacy Baza:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(SUBTYPE_LABELS).map(([subtypeKey, label]) => (
            <div key={subtypeKey} className="flex items-center space-x-2">
              <Tag color={
                subtypeKey === LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING ? 'volcano' :
                subtypeKey === LEGACY_DATABASE_SUBTYPES.GPS_TICKETING ? 'geekblue' :
                subtypeKey === LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING ? 'purple' :
                subtypeKey === LEGACY_DATABASE_SUBTYPES.CITY_TICKETING ? 'cyan' : 'default'
              }>
                {label}
              </Tag>
              <span className="text-sm text-gray-600">
                {(SUBTYPE_DESCRIPTIONS as Record<string, string>)[subtypeKey]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Search
          placeholder="Pretraži baze..."
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
          Nova Baza
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredDatabases}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
        className="bg-white rounded-lg shadow-sm"
      />

      {/* Modal za kreiranje/editovanje */}
      <Modal
        title={editingDatabase ? 'Izmeni Konfiguraciju Baze' : 'Nova Konfiguracija Baze'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'mysql',
            port: 3306,
            isActive: true,
          }}
        >
          <Form.Item
            name="name"
            label="Naziv Konekcije"
            rules={[{ required: true, message: 'Naziv konekcije je obavezan' }]}
          >
            <Input prefix={<DatabaseOutlined />} placeholder="npr. GSP Main Server" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Opis"
          >
            <Input.TextArea rows={2} placeholder="Opis baze podataka (opciono)" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Tip Baze"
            rules={[{ required: true, message: 'Tip baze je obavezan' }]}
          >
            <Select>
              <Option value="mysql">MySQL</Option>
              <Option value="postgresql">PostgreSQL</Option>
              <Option value="mongodb">MongoDB</Option>
              <Option value="oracle">Oracle</Option>
              <Option value="mssql">MS SQL Server</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="subtype"
            label="Podvrsta Baze"
          >
            <Select placeholder="Izaberite podvrstu (opciono)" allowClear>
              <Option value={LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING}>
                {SUBTYPE_LABELS[LEGACY_DATABASE_SUBTYPES.MAIN_TICKETING]}
              </Option>
              <Option value={LEGACY_DATABASE_SUBTYPES.GPS_TICKETING}>
                {SUBTYPE_LABELS[LEGACY_DATABASE_SUBTYPES.GPS_TICKETING]}
              </Option>
              <Option value={LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING}>
                {SUBTYPE_LABELS[LEGACY_DATABASE_SUBTYPES.GLOBAL_TICKETING]}
              </Option>
              <Option value={LEGACY_DATABASE_SUBTYPES.CITY_TICKETING}>
                {SUBTYPE_LABELS[LEGACY_DATABASE_SUBTYPES.CITY_TICKETING]}
              </Option>
              <Option value={LEGACY_DATABASE_SUBTYPES.CITY_GPS_TICKETING}>
                {SUBTYPE_LABELS[LEGACY_DATABASE_SUBTYPES.CITY_GPS_TICKETING]}
              </Option>
            </Select>
          </Form.Item>

          <Space size="large" style={{ width: '100%' }}>
            <Form.Item
              name="host"
              label="Host"
              rules={[{ required: true, message: 'Host je obavezan' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="npr. 192.168.1.100" />
            </Form.Item>

            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Port je obavezan' }]}
              style={{ width: 120 }}
            >
              <Input type="number" placeholder="3306" />
            </Form.Item>
          </Space>

          <Form.Item
            name="database"
            label="Naziv Baze Podataka"
            rules={[{ required: true, message: 'Naziv baze podataka je obavezan' }]}
          >
            <Input placeholder="npr. pib100049398" />
          </Form.Item>

          <Form.Item
            name="username"
            label="Korisničko Ime"
            rules={[{ required: true, message: 'Korisničko ime je obavezno' }]}
          >
            <Input placeholder="npr. db_user" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Lozinka"
            rules={[{ required: !editingDatabase, message: 'Lozinka je obavezna' }]}
          >
            <Input.Password placeholder={editingDatabase ? "Ostaviti prazno za zadržavanje postojeće" : "Unesite lozinku"} />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Status"
            valuePropName="checked"
          >
            <Switch checkedChildren="Aktivna" unCheckedChildren="Neaktivna" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Connection Results Modal */}
      <Modal
        title={`Test Konekcije: ${testedDatabase?.name || 'Database'}`}
        open={testModalVisible}
        onOk={() => {
          setTestModalVisible(false);
          loadDatabases(); // Refresh data
        }}
        onCancel={() => setTestModalVisible(false)}
        width={600}
        footer={[
          <Button key="ok" type="primary" onClick={() => {
            setTestModalVisible(false);
            loadDatabases();
          }}>
            U redu
          </Button>
        ]}
      >
        {testResult && testedDatabase && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-semibold mb-2">Parametri Konekcije:</h4>
              <div className="text-sm space-y-1">
                <div><strong>Host:</strong> {(testResult as any).connectionInfo?.host || testedDatabase.host}:{(testResult as any).connectionInfo?.port || testedDatabase.port}</div>
                <div><strong>Baza:</strong> {(testResult as any).connectionInfo?.database || testedDatabase.database}</div>
                <div><strong>Korisnik:</strong> {(testResult as any).connectionInfo?.username || testedDatabase.username}</div>
                <div><strong>Tip:</strong> {(testResult as any).connectionInfo?.type || testedDatabase.type}</div>
              </div>
            </div>
            
            <div className={`p-4 rounded ${(testResult as any).success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {(testResult as any).success ? 
                  <CheckCircleOutlined className="text-green-600" /> : 
                  <CloseCircleOutlined className="text-red-600" />
                }
                <span className={`font-semibold ${(testResult as any).success ? 'text-green-800' : 'text-red-800'}`}>
                  {(testResult as any).success ? 'USPEŠNO' : 'NEUSPEŠNO'}
                </span>
              </div>
              <div className="text-sm">
                <div><strong>Poruka:</strong> {(testResult as any).message}</div>
                {(testResult as any).responseTime && <div><strong>Vreme odziva:</strong> {(testResult as any).responseTime}ms</div>}
                {(testResult as any).error && <div><strong>Greška:</strong> {(testResult as any).error}</div>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LegacyDatabases;