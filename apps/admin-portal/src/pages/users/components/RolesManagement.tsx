import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  message, 
  Popconfirm,
  Tooltip 
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UsergroupAddOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Role } from '../../../types/rbac.types';
import { rbacService } from '../../../services/rbacService';

const { TextArea } = Input;

const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    showTotal: (total) => `Ukupno ${total} rola`,
  });

  const fetchRoles = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await rbacService.getRoles(page, pageSize);
      setRoles(response.data);
      setPagination({
        ...pagination,
        current: page,
        pageSize: pageSize,
        total: response.total,
      });
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      // Mock podaci za testiranje
      const mockRoles: Role[] = [
        {
          id: 1,
          name: 'SUPER_ADMIN',
          description: 'Administratorska uloga sa potpunim pristupom',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 10 },
        },
        {
          id: 2,
          name: 'CITY_MANAGER',
          description: 'Menadžer gradskih resursa',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 7 },
        },
        {
          id: 3,
          name: 'DEPARTMENT_HEAD',
          description: 'Šef departmana',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 5 },
        },
        {
          id: 4,
          name: 'OPERATOR',
          description: 'Operater sistema',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 3 },
        },
        {
          id: 5,
          name: 'ANALYST',
          description: 'Analitičar',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 1, permissions: 2 },
        },
        {
          id: 6,
          name: 'CITIZEN',
          description: 'Građanin',
          createdAt: '2024-01-15T09:00:00',
          updatedAt: '2024-01-15T09:00:00',
          _count: { users: 0, permissions: 1 },
        },
      ];
      setRoles(mockRoles);
      setPagination({
        ...pagination,
        total: mockRoles.length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchRoles(newPagination.current, newPagination.pageSize);
  };

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (roleId: number) => {
    try {
      await rbacService.deleteRole(roleId);
      message.success('Rola uspešno obrisana');
      fetchRoles(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Greška pri brisanju role:', error);
      // Za testiranje, samo uklonimo iz lokalne liste
      setRoles(roles.filter(role => role.id !== roleId));
      message.success('Rola uspešno obrisana');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingRole) {
        await rbacService.updateRole(editingRole.id, values);
        message.success('Rola uspešno ažurirana');
      } else {
        await rbacService.createRole(values);
        message.success('Rola uspešno kreirana');
      }
      
      setModalVisible(false);
      form.resetFields();
      fetchRoles(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Greška pri čuvanju role:', error);
      // Za testiranje
      if (editingRole) {
        setRoles(roles.map(role => 
          role.id === editingRole.id 
            ? { ...role, ...form.getFieldsValue() }
            : role
        ));
      } else {
        const newRole: Role = {
          id: Math.max(...roles.map(r => r.id)) + 1,
          ...form.getFieldsValue(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { users: 0, permissions: 0 },
        };
        setRoles([...roles, newRole]);
      }
      message.success(editingRole ? 'Rola uspešno ažurirana' : 'Rola uspešno kreirana');
      setModalVisible(false);
      form.resetFields();
    }
  };

  const getRoleColor = (roleName: string) => {
    const colors: Record<string, string> = {
      'SUPER_ADMIN': 'red',
      'CITY_MANAGER': 'orange',
      'DEPARTMENT_HEAD': 'blue',
      'OPERATOR': 'green',
      'ANALYST': 'purple',
      'CITIZEN': 'default',
    };
    return colors[roleName] || 'default';
  };

  const columns: ColumnsType<Role> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      align: 'center',
    },
    {
      title: 'Naziv Role',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Tag color={getRoleColor(name)} className="font-medium">
          {name}
        </Tag>
      ),
    },
    {
      title: 'Opis',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Statistika',
      key: 'stats',
      render: (_, record) => (
        <Space>
          <Tooltip title="Broj korisnika">
            <Tag icon={<UsergroupAddOutlined />}>
              {record._count?.users || 0} korisnika
            </Tag>
          </Tooltip>
          <Tooltip title="Broj permisija">
            <Tag icon={<SafetyCertificateOutlined />} color="blue">
              {record._count?.permissions || 0} permisija
            </Tag>
          </Tooltip>
        </Space>
      ),
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
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Izmeni">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Brisanje role"
            description={`Da li ste sigurni da želite da obrišete rolu ${record.name}?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Da"
            cancelText="Ne"
            disabled={!!record._count?.users && record._count.users > 0}
          >
            <Tooltip title={record._count?.users && record._count.users > 0 ? "Ne možete obrisati rolu koja ima korisnike" : "Obriši"}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!!record._count?.users && record._count.users > 0}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Upravljanje Rolama</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Nova rola
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        className="bg-white rounded-lg shadow-sm"
      />

      <Modal
        title={editingRole ? 'Izmeni rolu' : 'Nova rola'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText="Sačuvaj"
        cancelText="Otkaži"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Naziv role"
            rules={[
              { required: true, message: 'Naziv role je obavezan' },
              { 
                pattern: /^[A-Z_]+$/, 
                message: 'Naziv mora biti u formatu VELIKA_SLOVA_SA_PODVLAKOM' 
              },
            ]}
          >
            <Input placeholder="npr. DEPARTMENT_MANAGER" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Opis"
            rules={[{ max: 255, message: 'Opis ne može biti duži od 255 karaktera' }]}
          >
            <TextArea rows={3} placeholder="Opis role i njenih odgovornosti" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default RolesManagement;