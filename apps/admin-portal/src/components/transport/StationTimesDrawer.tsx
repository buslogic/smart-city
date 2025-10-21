import React, { useEffect, useState } from 'react';
import { Drawer, List, Typography, Spin, Empty, Divider, Tag } from 'antd';
import { ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { linesAdministrationService, StationTimes } from '../../services/linesAdministration.service';
import { message } from 'antd';

const { Title, Text } = Typography;

interface StationTimesDrawerProps {
  visible: boolean;
  onClose: () => void;
  idlinije: string | null;
  smer: number | null;
  dan: string | null;
  vreme: string | null;
}

const StationTimesDrawer: React.FC<StationTimesDrawerProps> = ({
  visible,
  onClose,
  idlinije,
  smer,
  dan,
  vreme,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StationTimes | null>(null);

  useEffect(() => {
    if (visible && idlinije && smer !== null && dan && vreme) {
      loadStationTimes();
    }
  }, [visible, idlinije, smer, dan, vreme]);

  const loadStationTimes = async () => {
    if (!idlinije || smer === null || !dan || !vreme) return;

    setLoading(true);
    try {
      const response = await linesAdministrationService.getStationTimes(
        idlinije,
        smer,
        dan,
        vreme
      );
      setData(response);
    } catch (error) {
      console.error('Greška pri učitavanju vremena po stanicama:', error);
      message.error('Greška pri učitavanju vremena po stanicama');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const parseStationTimes = (stanice: string): string[] => {
    if (!stanice || stanice.trim() === '') return [];
    return stanice.split(',').map((t) => t.trim());
  };

  const parseStationNames = (stationNames: string | undefined): string[] => {
    if (!stationNames || stationNames.trim() === '') return [];
    return stationNames.split('|||').map((name) => name.trim());
  };

  return (
    <Drawer
      title={
        <div>
          <ClockCircleOutlined className="mr-2" />
          Prolazna vremena po stanicama
        </div>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={400}
    >
      <Spin spinning={loading}>
        {data ? (
          <div>
            {/* Info header */}
            <div className="mb-4">
              <Text strong>Polazak: </Text>
              <Tag color="blue" style={{ fontSize: '14px' }}>
                {vreme}
              </Tag>
              <br />
              <Text strong>Dan: </Text>
              <Text>{dan?.toUpperCase()}</Text>
              <br />
              <Text strong>Smer: </Text>
              <Text>{smer === 0 ? 'A' : 'B'}</Text>
              {data.opis && (
                <>
                  <br />
                  <Text strong>Opis: </Text>
                  <Text type="secondary">{data.opis}</Text>
                </>
              )}
            </div>

            <Divider />

            {/* Stanice lista */}
            <Title level={5}>
              <EnvironmentOutlined className="mr-2" />
              Stanice
            </Title>

            <List
              dataSource={parseStationTimes(data.stanice)}
              renderItem={(time, index) => {
                const stationNames = parseStationNames(data.stationNames);
                const stationName = stationNames[index] || `Stanica ${index + 1}`;

                return (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: '#1890ff' }}>
                          {stationName}
                        </Text>
                        <Tag color="green" style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                          {time}
                        </Tag>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
              size="small"
            />
          </div>
        ) : (
          <Empty description="Nema podataka o prolaznim vremenima" />
        )}
      </Spin>
    </Drawer>
  );
};

export default StationTimesDrawer;
