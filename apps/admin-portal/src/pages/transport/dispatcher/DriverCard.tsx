import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Table, message, Spin, Row, Col, Divider, Avatar } from 'antd';
import { UserOutlined, IdcardOutlined, PrinterOutlined } from '@ant-design/icons';
import { dispatcherService } from '../../../services/dispatcher.service';
import { getAvatarUrl } from '../../../utils/avatar';

const { Title, Text } = Typography;
const { Option } = Select;

interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatar?: string | null;
  userGroup: {
    id: number;
    groupName: string;
  };
}

interface DriverCard {
  driver: {
    id: number;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    avatar?: string | null;
    userGroup: {
      id: number;
      groupName: string;
    };
    employedSince: string;
  };
  contactInfo: {
    address: string;
    phone1: string;
    phone2: string;
    employeeNumber: string;
  };
  workHistory: {
    years: string[];
    months: string[];
    data: Record<string, any>;
  };
}

const DriverCard: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [driverCard, setDriverCard] = useState<DriverCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Učitaj listu vozača pri učitavanju komponente
  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const response = await dispatcherService.getDrivers();
      if (response.success) {
        setDrivers(response.data);
      } else {
        message.error('Greška pri učitavanju vozača');
      }
    } catch (error: any) {
      console.error('Greška pri učitavanju vozača:', error);
      message.error(error.response?.data?.message || 'Greška pri učitavanju vozača');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleGenerateCard = async () => {
    if (!selectedDriverId) {
      message.warning('Molimo odaberite vozača');
      return;
    }

    setLoading(true);
    try {
      const response = await dispatcherService.getDriverCard(selectedDriverId);
      if (response.success) {
        setDriverCard(response.data);
      } else {
        message.error('Greška pri generisanju kartona vozača');
      }
    } catch (error: any) {
      console.error('Greška pri generisanju kartona vozača:', error);
      message.error(error.response?.data?.message || 'Greška pri generisanju kartona vozača');
    } finally {
      setLoading(false);
    }
  };

  const createTableData = () => {
    if (!driverCard) return [];

    const { months, years } = driverCard.workHistory;

    return months.map(month => {
      const row: any = { month };
      years.forEach(year => {
        row[year] = ''; // Prazno za sada
      });
      return row;
    });
  };

  const createTableColumns = () => {
    if (!driverCard) return [];

    const { years } = driverCard.workHistory;

    const columns = [
      {
        title: 'MESEC',
        dataIndex: 'month',
        key: 'month',
        fixed: 'left' as const,
        width: 120,
        className: 'font-semibold',
      },
    ];

    years.forEach(year => {
      columns.push({
        title: `${year}.`,
        dataIndex: year,
        key: year,
        width: 120,
        className: 'text-center',
      });
    });

    return columns;
  };

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <UserOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Karton Vozača</Title>
        </div>

        {/* Odabir vozača */}
        <div className="mb-6">
          <Row gutter={16} align="middle">
            <Col xs={24} sm={16} md={12} lg={8}>
              <div className="mb-2">
                <Text strong>Odaberite vozača:</Text>
              </div>
              <Select
                style={{ width: '100%' }}
                placeholder="Odaberite vozača"
                value={selectedDriverId}
                onChange={setSelectedDriverId}
                loading={loadingDrivers}
                showSearch
                filterOption={(input, option) => {
                  const driver = drivers.find(d => d.id === option?.value);
                  if (!driver) return false;
                  const searchText = `${driver.fullName} ${driver.userGroup.groupName}`.toLowerCase();
                  return searchText.includes(input.toLowerCase());
                }}
                optionLabelProp="label"
              >
                {drivers.length > 0 ? drivers.map(driver => (
                  <Option
                    key={driver.id}
                    value={driver.id}
                    label={`${driver.fullName} (${driver.userGroup.groupName})`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        size={24}
                        src={getAvatarUrl(driver.avatar)}
                        icon={!getAvatarUrl(driver.avatar) && <UserOutlined />}
                      />
                      <span>{driver.fullName} ({driver.userGroup.groupName})</span>
                    </div>
                  </Option>
                )) : (
                  <Option disabled value="no-drivers">
                    {loadingDrivers ? 'Učitavam vozače...' : 'Nema dostupnih vozača'}
                  </Option>
                )}
              </Select>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<IdcardOutlined />}
                onClick={handleGenerateCard}
                disabled={!selectedDriverId}
                loading={loading}
              >
                Generiši karton
              </Button>
            </Col>
          </Row>
        </div>

        {/* Prikaz kartona vozača */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        )}

        {driverCard && !loading && (
          <div className="driver-card-content" style={{ minHeight: '600px' }}>
            <div className="flex justify-between items-center mb-4">
              <Title level={3} className="mb-0">
                Karton vozača - {driverCard.driver.fullName}
              </Title>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                Štampaj
              </Button>
            </div>

            <Divider />

            {/* Sekcija sa osnovnim podacima */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Levi deo - fotografija i osnovi podaci */}
              <div>
                <Row gutter={16}>
                  <Col span={8}>
                    <div className="border-2 border-gray-300 h-32 flex items-center justify-center bg-gray-50">
                      {driverCard.driver.avatar ? (
                        <Avatar
                          size={120}
                          src={getAvatarUrl(driverCard.driver.avatar)}
                          className="object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <UserOutlined className="text-4xl text-gray-400 mb-2" />
                          <Text type="secondary" className="text-xs block">FOTOGRAFIJA<br />ZAPOSLENOG</Text>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col span={16}>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Text strong>IME I PREZIME:</Text>
                        <Text className="col-span-2">{driverCard.driver.fullName}</Text>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Text strong>SLUŽBENI BROJ:</Text>
                        <Text className="col-span-2">{driverCard.contactInfo.employeeNumber || '-'}</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Desni deo - kontakt podaci */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>ADRESA STANOVANJA:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.address || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KONTAKT TELEFON 01:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.phone1 || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KONTAKT TELEFON 02:</Text>
                  <Text className="col-span-2">{driverCard.contactInfo.phone2 || '-'}</Text>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Text strong>KRSNA SLAVA:</Text>
                  <Text className="col-span-2">-</Text>
                </div>
              </div>
            </div>

            <Divider />

            {/* Tabela sa godinama i mesecima */}
            <div className="mt-6">
              <Table
                dataSource={createTableData()}
                columns={createTableColumns()}
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 800 }}
                className="driver-work-history-table"
                rowKey="month"
                style={{
                  '--ant-table-thead-bg': '#f5f5f5',
                  '--ant-table-cell-padding-vertical': '8px',
                } as React.CSSProperties}
              />
            </div>
          </div>
        )}

        {!driverCard && !loading && (
          <div className="text-center py-20 text-gray-500">
            <IdcardOutlined className="text-6xl mb-4" />
            <p className="text-lg">Odaberite vozača i kliknite "Generiši karton" da biste videli karton vozača</p>
          </div>
        )}
      </Card>

      <style>
        {`
          .driver-work-history-table .ant-table-thead > tr > th {
            text-align: center !important;
            font-weight: 600 !important;
            background-color: #f5f5f5 !important;
          }

          .driver-work-history-table .ant-table-tbody > tr > td {
            height: 40px !important;
            border: 1px solid #d9d9d9 !important;
          }

          @media print {
            .ant-btn, .ant-select, .p-6 {
              display: none !important;
            }

            .driver-card-content {
              margin: 0 !important;
              padding: 20px !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default DriverCard;