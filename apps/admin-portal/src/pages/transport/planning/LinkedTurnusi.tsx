import React from 'react';
import { Card, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const { Title } = Typography;

const LinkedTurnusi: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <LinkOutlined className="text-2xl text-blue-500" />
          <Title level={2} className="mb-0">Povezani turnusi</Title>
        </div>

        <div className="text-gray-600">
          <p>Modul za upravljanje povezanim turnusima između linija i vozača.</p>
        </div>
      </Card>
    </div>
  );
};

export default LinkedTurnusi;
