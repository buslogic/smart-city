import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CityServerTab: React.FC = () => {
  return (
    <div>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <GlobalOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
          <Title level={4} style={{ marginTop: 16 }}>
            Gradski Server
          </Title>
          <Text type="secondary">
            Funkcionalnost za Gradski Server biće dodana u budućnosti
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default CityServerTab;
