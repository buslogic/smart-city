import React, { useState } from 'react';
import { Modal, Button, message, Typography, Space, Tag } from 'antd';
import { ExclamationCircleOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import { userService } from '../../services/userService';
import { usePermissions } from '../../hooks/usePermissions';
import { User } from '../../types/user.types';

const { Text } = Typography;

interface DeleteUserModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  visible,
  user,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const { canDeleteUsers } = usePermissions();

  const handleDelete = async () => {
    if (!canDeleteUsers() || !user) {
      message.error('Nemate dozvolu za brisanje korisnika');
      return;
    }

    try {
      setLoading(true);
      
      await userService.deleteUser(user.id);
      
      message.success(`Korisnik ${user.firstName} ${user.lastName} je uspešno obrisan`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Greška pri brisanju korisnika:', error);
      const errorMessage = error.response?.data?.message || 'Greška pri brisanju korisnika';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!user) return null;

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <span>Potvrda brisanja</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={500}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Otkaži
        </Button>,
        <Button
          key="delete"
          type="primary"
          danger
          loading={loading}
          onClick={handleDelete}
          disabled={!canDeleteUsers()}
        >
          Obriši korisnika
        </Button>,
      ]}
    >
      <div className="py-4">
        <Text className="text-base">
          Da li ste sigurni da želite da obrišete sledećeg korisnika?
        </Text>
        
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Space direction="vertical" size="small" className="w-full">
            <div className="flex items-center gap-2">
              <UserOutlined className="text-gray-500" />
              <Text strong>{user.firstName} {user.lastName}</Text>
            </div>
            
            <div className="flex items-center gap-2">
              <MailOutlined className="text-gray-500" />
              <Text>{user.email}</Text>
            </div>
            
            <div className="flex items-center gap-2">
              <Text className="text-gray-500">Uloge:</Text>
              <Space wrap>
                {user.roles?.map(role => (
                  <Tag key={role} color="blue">
                    {role}
                  </Tag>
                ))}
              </Space>
            </div>
            
            <div className="flex items-center gap-2">
              <Text className="text-gray-500">Status:</Text>
              <Tag color={user.isActive ? 'green' : 'red'}>
                {user.isActive ? 'Aktivan' : 'Neaktivan'}
              </Tag>
            </div>
          </Space>
        </div>
        
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <Text type="danger" className="text-sm">
            <strong>Upozorenje:</strong> Ova akcija se ne može poništiti. 
            Korisnik će biti trajno obrisan iz sistema sa svim povezanim podacima.
          </Text>
        </div>
      </div>
    </Modal>
  );
};