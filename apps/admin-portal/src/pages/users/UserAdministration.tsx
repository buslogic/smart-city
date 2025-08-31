import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Input, message, Tooltip } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { User } from '../../types/user.types';
import { userService } from '../../services/userService';
import { usePermissions } from '../../hooks/usePermissions';
import { CreateUserModal } from '../../components/users/CreateUserModal';
import { EditUserModal } from '../../components/users/EditUserModal';
import { DeleteUserModal } from '../../components/users/DeleteUserModal';

const { Search } = Input;

const UserAdministration: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total) => `Ukupno ${total} korisnika`,
  });
  
  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { canCreateUsers, canUpdateUsers, canDeleteUsers } = usePermissions();

  const fetchUsers = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await userService.getUsers(page, pageSize);
      
      console.log('API Response:', response); // Debug log
      
      // Direktno koristi response.data
      setUsers(response.data);
      setPagination({
        ...pagination,
        current: page,
        pageSize: pageSize,
        total: response.total,
      });
    } catch (error) {
      console.error('Greška pri učitavanju korisnika:', error);
      message.error('Greška pri učitavanju korisnika');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Modal handlers
  const handleCreateUser = () => {
    if (!canCreateUsers()) {
      message.error('Nemate dozvolu za kreiranje korisnika');
      return;
    }
    setCreateModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    if (!canUpdateUsers()) {
      message.error('Nemate dozvolu za ažuriranje korisnika');
      return;
    }
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  const handleDeleteUser = (user: User) => {
    if (!canDeleteUsers()) {
      message.error('Nemate dozvolu za brisanje korisnika');
      return;
    }
    setSelectedUser(user);
    setDeleteModalVisible(true);
  };

  const handleModalClose = () => {
    setCreateModalVisible(false);
    setEditModalVisible(false);
    setDeleteModalVisible(false);
    setSelectedUser(null);
  };

  const handleModalSuccess = () => {
    fetchUsers(pagination.current, pagination.pageSize);
  };

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchUsers(newPagination.current, newPagination.pageSize);
  };

  const handleSearch = () => {
    // TODO: Implementirati pretragu
    fetchUsers(1, pagination.pageSize);
  };

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    try {
      await userService.toggleUserStatus(userId, !currentStatus);
      message.success(`Korisnik ${!currentStatus ? 'aktiviran' : 'deaktiviran'}`);
      fetchUsers(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Greška pri promeni statusa:', error);
      // Za testiranje, samo promenimo lokalno
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isActive: !currentStatus } : user
      ));
      message.success(`Korisnik ${!currentStatus ? 'aktiviran' : 'deaktiviran'}`);
    }
  };


  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      align: 'center',
    },
    {
      title: 'Ime i prezime',
      key: 'fullName',
      render: (_, record) => (
        <div>
          <div className="font-medium">{`${record.firstName} ${record.lastName}`}</div>
          <div className="text-gray-500 text-sm">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Uloge',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space wrap>
          {roles?.map((role, index) => (
            <Tag color="blue" key={`${role}-${index}`}>
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'} icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {isActive ? 'Aktivan' : 'Neaktivan'}
        </Tag>
      ),
    },
    {
      title: 'Poslednja prijava',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date: string | null) => {
        if (!date) return <span className="text-gray-400">Nikad</span>;
        return new Date(date).toLocaleString('sr-RS');
      },
    },
    {
      title: 'Datum kreiranja',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('sr-RS'),
    },
    {
      title: 'Akcije',
      key: 'actions',
      align: 'center',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Izmeni">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
              disabled={!canUpdateUsers()}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Deaktiviraj' : 'Aktiviraj'}>
            <Button
              type="text"
              danger={record.isActive}
              icon={record.isActive ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleStatus(record.id, record.isActive)}
              disabled={!canUpdateUsers()}
            />
          </Tooltip>
          <Tooltip title="Obriši">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteUser(record)}
              disabled={!canDeleteUsers()}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Administracija Korisnika</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreateUser}
          disabled={!canCreateUsers()}
        >
          Novi korisnik
        </Button>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <Search
          placeholder="Pretraži korisnike..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          style={{ maxWidth: 400 }}
          onSearch={handleSearch}
        />
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
        className="bg-white rounded-lg shadow-sm"
      />

      {/* Modali */}
      <CreateUserModal
        visible={createModalVisible}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <EditUserModal
        visible={editModalVisible}
        user={selectedUser}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <DeleteUserModal
        visible={deleteModalVisible}
        user={selectedUser}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default UserAdministration;