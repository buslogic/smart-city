import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MainServerTab: React.FC = () => {
  return (
    <div>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <DatabaseOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
          <Title level={4} style={{ marginTop: 16 }}>
            Glavni Server
          </Title>
          <Text type="secondary">
            Funkcionalnost za Glavni Server biće dodana u budućnosti
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default MainServerTab;
