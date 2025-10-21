import React from 'react';
import { Tag } from 'antd';
import { VariationStatus, VariationStatusType } from '../../services/linesAdministration.service';

interface StatusBadgeProps {
  status: VariationStatusType;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case VariationStatus.AKTUELNA:
        return { color: 'success', text: 'AKTUELNA' };
      case VariationStatus.BUDUCA:
        return { color: 'processing', text: 'BUDUĆA' };
      case VariationStatus.ISTEKLA:
        return { color: 'default', text: 'ISTEKLA' };
      case VariationStatus.BEZ_VARIJACIJE:
        return { color: 'warning', text: 'BEZ VARIJACIJE' };
      default:
        return { color: 'default', text: status };
    }
  };

  const config = getStatusConfig();

  return <Tag color={config.color}>{config.text}</Tag>;
};

export default StatusBadge;
