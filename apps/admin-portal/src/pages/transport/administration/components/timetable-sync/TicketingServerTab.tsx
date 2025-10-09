import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Select,
  Alert,
} from 'antd';
import {
  ShoppingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { timetableDatesService, TimetableDate } from '../../../../../services/timetableDates.service';

const { Title, Text } = Typography;

const TicketingServerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TimetableDate[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const result = await timetableDatesService.getAllTicketing();
      setGroups(result);
    } catch (error: any) {
      console.error('Greška pri učitavanju grupa:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <ShoppingOutlined style={{ fontSize: 24, color: '#722ed1' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Tiketing Server</Title>
                <Text type="secondary">RedVoznje sinhronizacija - Ticketing server (READ-ONLY)</Text>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="mb-4">
        <Row gutter={16}>
          <Col span={24}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Izaberite grupu datuma (RedVoznje):</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Odaberite grupu datuma"
                value={selectedGroup}
                onChange={setSelectedGroup}
                loading={loading}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={groups.map((group: any) => ({
                  value: group.date_valid_from || group.dateValidFrom,
                  label: `${group.name} | ${group.date_valid_from || group.dateValidFrom} | Status: ${group.status}`,
                }))}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedGroup && (
        <Card>
          <Alert
            message="Grupa datuma odabrana"
            description={`Odabrana grupa: ${selectedGroup}. Funkcionalnost za sinhronizaciju će biti implementirana...`}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </Card>
      )}
    </div>
  );
};

export default TicketingServerTab;
