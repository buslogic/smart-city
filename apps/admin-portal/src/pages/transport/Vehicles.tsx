import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  message,
  Tooltip,
  Modal,
  Form,
  Select,
  DatePicker,
  Row,
  Col,
  Card,
  Statistic,
  Switch,
  Checkbox,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CarOutlined,
  ReloadOutlined,
  WifiOutlined,
  SafetyOutlined,
  VideoCameraOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { usePermissions } from '../../hooks/usePermissions';
import {
  vehiclesService,
  type Vehicle,
  type CreateVehicleDto,
  type UpdateVehicleDto,
  VEHICLE_TYPES,
  FUEL_TYPES,
  VEHICLE_BRANDS,
  VEHICLE_MODELS,
} from '../../services/vehicles.service';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form] = Form.useForm();
  const [statistics, setStatistics] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<number | undefined>(undefined);

  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('vehicles:create');
  const canUpdate = hasPermission('vehicles:update');
  const canDelete = hasPermission('vehicles:delete');

  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total) => `Ukupno ${total} vozila`,
  });

  // Load vehicles
  const loadVehicles = async () => {
    try {
      setLoading(true);
      const response = await vehiclesService.getAll(
        pagination.current || 1,
        pagination.pageSize || 10,
        searchTerm,
        activeFilter,
        vehicleTypeFilter
      );
      setVehicles(response.data);
      setPagination({
        ...pagination,
        total: response.total,
      });
    } catch (error) {
      console.error('Error loading vehicles:', error);
      message.error('Greška pri učitavanju vozila');
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStatistics = async () => {
    try {
      const stats = await vehiclesService.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  useEffect(() => {
    loadVehicles();
    loadStatistics();
  }, [pagination.current, pagination.pageSize, searchTerm, activeFilter, vehicleTypeFilter]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination({ ...pagination, current: 1 });
  };

  const handleCreate = () => {
    setEditingVehicle(null);
    form.resetFields();
    form.setFieldsValue({
      active: true,
      visible: true,
      seatCapacity: 0,
      standingCapacity: 0,
      totalCapacity: 0,
      wifi: false,
      airCondition: false,
      rampForDisabled: false,
      videoSystem: false,
      lowFloor: false,
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Vehicle) => {
    setEditingVehicle(record);
    form.setFieldsValue({
      ...record,
      yearOfManufacture: record.yearOfManufacture ? dayjs(record.yearOfManufacture) : null,
      technicalControlFrom: record.technicalControlFrom ? dayjs(record.technicalControlFrom) : null,
      technicalControlTo: record.technicalControlTo ? dayjs(record.technicalControlTo) : null,
      registrationValidTo: record.registrationValidTo ? dayjs(record.registrationValidTo) : null,
      firstRegistrationDate: record.firstRegistrationDate ? dayjs(record.firstRegistrationDate) : null,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Potvrda brisanja',
      content: 'Da li ste sigurni da želite da obrišete ovo vozilo?',
      okText: 'Da, obriši',
      cancelText: 'Otkaži',
      okType: 'danger',
      onOk: async () => {
        try {
          await vehiclesService.delete(id);
          message.success('Vozilo je uspešno obrisano');
          await loadVehicles();
          await loadStatistics();
        } catch (error) {
          console.error('Error deleting vehicle:', error);
          message.error('Greška pri brisanju vozila');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Convert dayjs dates to ISO strings
      const formData = {
        ...values,
        yearOfManufacture: values.yearOfManufacture ? values.yearOfManufacture.toISOString() : null,
        technicalControlFrom: values.technicalControlFrom ? values.technicalControlFrom.toISOString() : null,
        technicalControlTo: values.technicalControlTo ? values.technicalControlTo.toISOString() : null,
        registrationValidTo: values.registrationValidTo ? values.registrationValidTo.toISOString() : null,
        firstRegistrationDate: values.firstRegistrationDate ? values.firstRegistrationDate.toISOString() : null,
      };

      if (editingVehicle) {
        await vehiclesService.update(editingVehicle.id, formData);
        message.success('Vozilo je uspešno ažurirano');
      } else {
        await vehiclesService.create(formData);
        message.success('Novo vozilo je uspešno kreirano');
      }

      setModalVisible(false);
      form.resetFields();
      await loadVehicles();
      await loadStatistics();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      if (error.response?.status === 409) {
        message.error(error.response.data.message || 'Vozilo sa tim podacima već postoji');
      } else {
        message.error('Greška pri čuvanju vozila');
      }
    }
  };

  const handleCapacityChange = () => {
    const seatCapacity = form.getFieldValue('seatCapacity') || 0;
    const standingCapacity = form.getFieldValue('standingCapacity') || 0;
    form.setFieldsValue({ totalCapacity: seatCapacity + standingCapacity });
  };

  const columns: ColumnsType<Vehicle> = [
    {
      title: 'Garažni broj',
      dataIndex: 'garageNumber',
      key: 'garageNumber',
      width: 120,
      fixed: 'left',
      render: (text) => <span className="font-mono font-bold">{text}</span>,
    },
    {
      title: 'Registracija',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Tip',
      dataIndex: 'vehicleType',
      key: 'vehicleType',
      width: 150,
      render: (type: any) => (
        <Tag color="blue">{(VEHICLE_TYPES as Record<string, string>)[type] || `Tip ${type}`}</Tag>
      ),
    },
    {
      title: 'Brend',
      dataIndex: 'vehicleBrand',
      key: 'vehicleBrand',
      width: 120,
      render: (brand: any) => (VEHICLE_BRANDS as Record<string, string>)[brand] || '-',
    },
    {
      title: 'Gorivo',
      dataIndex: 'fuelType',
      key: 'fuelType',
      width: 120,
      render: (fuel: any) => {
        const fuelName = (FUEL_TYPES as Record<string, string>)[fuel];
        const colors: Record<string, string> = {
          2: 'orange', // Dizel
          3: 'green',  // CNG
          4: 'blue',   // Električni
          5: 'purple', // Hibrid
        };
        return fuel ? (
          <Tag color={colors[fuel] || 'default'}>{fuelName || `Tip ${fuel}`}</Tag>
        ) : '-';
      },
    },
    {
      title: 'Kapacitet',
      key: 'capacity',
      width: 150,
      render: (_, record) => (
        <span>
          {record.seatCapacity} + {record.standingCapacity} = {record.totalCapacity}
        </span>
      ),
    },
    {
      title: 'Oprema',
      key: 'equipment',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {record.wifi && <Tooltip title="WiFi"><WifiOutlined style={{ color: '#1890ff' }} /></Tooltip>}
          {record.airCondition && <Tooltip title="Klima">❄️</Tooltip>}
          {record.rampForDisabled && <Tooltip title="Rampa za invalide">♿</Tooltip>}
          {record.videoSystem && <Tooltip title="Video nadzor"><VideoCameraOutlined /></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'Tehnički',
      dataIndex: 'technicalControlTo',
      key: 'technicalControlTo',
      width: 120,
      render: (date) => {
        if (!date) return '-';
        const isExpiring = dayjs(date).diff(dayjs(), 'day') < 30;
        return (
          <Tag color={isExpiring ? 'warning' : 'success'}>
            {dayjs(date).format('DD.MM.YYYY')}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'success' : 'error'}>
          {active ? 'Aktivan' : 'Neaktivan'}
        </Tag>
      ),
    },
    {
      title: 'Akcije',
      key: 'actions',
      width: 120,
      fixed: 'right',
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
      {/* Statistics Cards */}
      {statistics && (
        <Row gutter={16} className="mb-4">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Ukupno vozila"
                value={statistics.total}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Aktivna"
                value={statistics.active}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Neaktivna"
                value={statistics.inactive}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Sa WiFi"
                value={statistics.withWifi}
                prefix={<WifiOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Search
            placeholder="Pretraži vozila..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            style={{ width: 300 }}
            onSearch={handleSearch}
          />
          <Select
            placeholder="Status"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => {
              setActiveFilter(value);
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value={true}>Aktivna</Option>
            <Option value={false}>Neaktivna</Option>
          </Select>
          <Select
            placeholder="Tip vozila"
            style={{ width: 200 }}
            allowClear
            onChange={(value) => {
              setVehicleTypeFilter(value);
              setPagination({ ...pagination, current: 1 });
            }}
          >
            {Object.entries(VEHICLE_TYPES).map(([key, value]) => (
              <Option key={key} value={parseInt(key)}>
                {value}
              </Option>
            ))}
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadVehicles();
              loadStatistics();
            }}
          >
            Osveži
          </Button>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          disabled={!canCreate}
        >
          Novo Vozilo
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={vehicles}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
        scroll={{ x: 1500 }}
        className="bg-white rounded-lg shadow-sm"
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingVehicle ? 'Izmeni Vozilo' : 'Novo Vozilo'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="Sačuvaj"
        cancelText="Otkaži"
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, values) => {
            if ('seatCapacity' in values || 'standingCapacity' in values) {
              handleCapacityChange();
            }
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="garageNumber"
                label="Garažni broj"
                rules={[{ required: true, message: 'Garažni broj je obavezan' }]}
              >
                <Input prefix={<CarOutlined />} placeholder="npr. P80123" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="registrationNumber"
                label="Registarska oznaka"
              >
                <Input placeholder="npr. BG-123-AB" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="vehicleNumber"
                label="Broj vozila"
              >
                <Input placeholder="npr. 123" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="vehicleType" label="Tip vozila">
                <Select placeholder="Izaberite tip">
                  {Object.entries(VEHICLE_TYPES).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vehicleBrand" label="Brend">
                <Select placeholder="Izaberite brend">
                  {Object.entries(VEHICLE_BRANDS).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vehicleModel" label="Model">
                <Select placeholder="Izaberite model">
                  {Object.entries(VEHICLE_MODELS).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="fuelType" label="Tip goriva">
                <Select placeholder="Izaberite tip goriva">
                  {Object.entries(FUEL_TYPES).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>
                      {value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="chassisNumber" label="Broj šasije">
                <Input placeholder="Broj šasije" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="motorNumber" label="Broj motora">
                <Input placeholder="Broj motora" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Kapacitet</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="seatCapacity" label="Broj sedišta">
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="standingCapacity" label="Mesta za stajanje">
                <Input type="number" min={0} max={200} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="totalCapacity" label="Ukupan kapacitet">
                <Input type="number" disabled />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Oprema</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Space direction="vertical">
                <Form.Item name="wifi" valuePropName="checked">
                  <Checkbox>WiFi</Checkbox>
                </Form.Item>
                <Form.Item name="airCondition" valuePropName="checked">
                  <Checkbox>Klima</Checkbox>
                </Form.Item>
                <Form.Item name="rampForDisabled" valuePropName="checked">
                  <Checkbox>Rampa za invalide</Checkbox>
                </Form.Item>
              </Space>
            </Col>
            <Col span={12}>
              <Space direction="vertical">
                <Form.Item name="videoSystem" valuePropName="checked">
                  <Checkbox>Video nadzor</Checkbox>
                </Form.Item>
                <Form.Item name="lowFloor" valuePropName="checked">
                  <Checkbox>Niskopodni autobus</Checkbox>
                </Form.Item>
              </Space>
            </Col>
          </Row>

          <Divider>Važni datumi</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="technicalControlFrom" label="Početak tehničkog">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="technicalControlTo" label="Istek tehničkog">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="registrationValidTo" label="Istek registracije">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstRegistrationDate" label="Prva registracija">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="yearOfManufacture" label="Godina proizvodnje">
                <DatePicker picker="year" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="legacyId" label="Legacy ID">
                <Input type="number" placeholder="ID iz originalne baze" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>GPS i dodatno</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="imei" label="IMEI">
                <Input placeholder="IMEI broj GPS uređaja" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="imeiNet" label="IMEI Net">
                <Input placeholder="IMEI Net broj" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="gpsModel" label="Model GPS">
                <Input placeholder="npr. Teltonika FMB920" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="active" valuePropName="checked">
                <Checkbox>Vozilo je aktivno</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visible" valuePropName="checked">
                <Checkbox>Vozilo je vidljivo</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Napomena">
            <TextArea rows={3} placeholder="Dodatne napomene..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Vehicles;