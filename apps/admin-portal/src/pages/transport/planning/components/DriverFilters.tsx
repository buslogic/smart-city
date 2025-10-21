/**
 * Komponenta za prikaz i upravljanje filterima vozača
 * Prikazuje se kao levi sidebar u modalu za izbor vozača
 */

import React from 'react';
import { Space, Card, Checkbox, Typography } from 'antd';
import { Filter } from '../hooks/useDriverFilters';

const { Title, Paragraph } = Typography;

interface DriverFiltersProps {
  filters: Filter[];
  onToggle: (filterId: string) => void;
}

export const DriverFilters: React.FC<DriverFiltersProps> = ({
  filters,
  onToggle,
}) => {
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <Title level={5} style={{ marginBottom: 16 }}>
        Filteri
      </Title>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {filters.map((filter) => (
          <Card key={filter.id} size="small">
            <Checkbox
              checked={filter.enabled}
              onChange={() => onToggle(filter.id)}
            >
              <strong>{filter.name}</strong>
            </Checkbox>

            <Paragraph
              type="secondary"
              style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
            >
              {filter.description}
            </Paragraph>
          </Card>
        ))}
      </Space>

      <Card size="small" style={{ marginTop: 16, backgroundColor: '#f0f5ff' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <strong>Napomena:</strong> Filtri se automatski primenjuju na listu vozača.
          Isključite filter ako želite da vidite sve vozače bez obzira na ograničenja.
        </Typography.Text>
      </Card>
    </div>
  );
};
