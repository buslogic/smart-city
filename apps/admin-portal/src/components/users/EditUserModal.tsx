import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Row, Col, Spin, Divider } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons';
import { userService } from '../../services/userService';
import { rbacService } from '../../services/rbacService';
import { userGroupsService, UserGroup } from '../../services/userGroups';
import { usePermissions } from '../../hooks/usePermissions';
import { User } from '../../types/user.types';
import { Role } from '../../types/rbac.types';
import AvatarUpload from './AvatarUpload';

const { Option } = Select;

interface EditUserModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditUserForm {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  userGroupId?: number | null;
  avatar?: string | null;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  visible,
  user,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm<EditUserForm>();
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<UserGroup[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { canUpdateUsers } = usePermissions();

  // Učitaj role kada se modal otvori
  useEffect(() => {
    if (visible) {
      fetchRoles();
      fetchUserGroups();
      if (user) {
        form.setFieldsValue({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || [],
          isActive: user.isActive,
          userGroupId: user.userGroupId,
        });
        setAvatarUrl(user.avatar || null);
      }
    }
  }, [visible, user, form]);

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await rbacService.getRoles(1, 100); // Učitaj sve role
      setAvailableRoles(response.data);
    } catch (error) {
      console.error('Greška pri učitavanju rola:', error);
      message.error('Greška pri učitavanju rola');
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchUserGroups = async () => {
    try {
      setLoadingGroups(true);
      const groups = await userGroupsService.getAll({ includeInactive: false });
      setAvailableGroups(groups);
    } catch (error) {
      console.error('Greška pri učitavanju grupa korisnika:', error);
      message.error('Greška pri učitavanju grupa korisnika');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSubmit = async (values: EditUserForm) => {
    if (!canUpdateUsers() || !user) {
      message.error('Nemate dozvolu za ažuriranje korisnika');
      return;
    }

    try {
      setLoading(true);

      // Validacija lozinki ako se menjaju
      // Priprema podataka
      const userData: any = {
        email: values.email.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        isActive: values.isActive,
        roles: values.roles,
        userGroupId: values.userGroupId === undefined ? user.userGroupId : values.userGroupId,
        avatar: avatarUrl,
      };

      await userService.updateUser(user.id, userData);
      
      message.success('Korisnik je uspešno ažuriran');
      form.resetFields();
      setAvatarUrl(null);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Greška pri ažuriranju korisnika:', error);
      const errorMessage = error.response?.data?.message || 'Greška pri ažuriranju korisnika';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setAvatarUrl(null);
    onClose();
  };

  const handleAvatarChange = (newAvatarUrl: string | null) => {
    setAvatarUrl(newAvatarUrl);
  };

  return (
    <Modal
      title={`Uređivanje korisnika: ${user?.firstName} ${user?.lastName}`}
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={null}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {/* Avatar Upload Section */}
        <div className="text-center mb-6">
          <div className="mb-3">
            <h4>Avatar korisnika</h4>
            <p className="text-sm text-gray-500">Trenutni avatar korisnika - možete promeniti ili ukloniti</p>
          </div>
          <AvatarUpload
            avatarUrl={avatarUrl}
            onAvatarChange={handleAvatarChange}
            size={100}
            showRemoveButton={true}
          />
        </div>

        <Divider>Osnovni podaci</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="firstName"
              label="Ime"
              rules={[
                { required: true, message: 'Ime je obavezno' },
                { min: 2, message: 'Ime mora imati najmanje 2 karaktera' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Unesite ime"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="lastName"
              label="Prezime"
              rules={[
                { required: true, message: 'Prezime je obavezno' },
                { min: 2, message: 'Prezime mora imati najmanje 2 karaktera' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Unesite prezime"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label="Email adresa"
          rules={[
            { required: true, message: 'Email je obavezan' },
            { type: 'email', message: 'Email mora biti valjan' },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="korisnik@smart-city.rs"
          />
        </Form.Item>


        <Form.Item
          name="roles"
          label="Uloge"
          rules={[
            { required: true, message: 'Morate odabrati najmanje jednu ulogu' },
          ]}
        >
          <Select
            mode="multiple"
            placeholder="Odaberite uloge korisnika"
            optionLabelProp="label"
            loading={loadingRoles}
            notFoundContent={loadingRoles ? <Spin size="small" /> : 'Nema dostupnih rola'}
          >
            {availableRoles.map(role => (
              <Option key={role.name} value={role.name} label={role.name}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{role.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {role.description || 'Nema opisa'}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="userGroupId"
          label="Grupa korisnika"
        >
          <Select
            placeholder="Odaberite grupu korisnika"
            allowClear
            loading={loadingGroups}
            notFoundContent={loadingGroups ? <Spin size="small" /> : 'Nema dostupnih grupa'}
            suffixIcon={<TeamOutlined />}
          >
            {availableGroups.map(group => (
              <Option key={group.id} value={group.id}>
                {group.groupName}
                {group.driver && ' (Vozač)'}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="isActive"
          label="Status"
        >
          <Select>
            <Option value={true}>Aktivan</Option>
            <Option value={false}>Neaktivan</Option>
          </Select>
        </Form.Item>

        <Form.Item className="mb-0 flex justify-end">
          <Button onClick={handleCancel} className="mr-2">
            Otkaži
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            disabled={!canUpdateUsers()}
          >
            Sačuvaj izmene
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};