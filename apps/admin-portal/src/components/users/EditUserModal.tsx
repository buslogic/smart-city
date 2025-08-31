import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message, Row, Col, Spin } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { userService } from '../../services/userService';
import { rbacService } from '../../services/rbacService';
import { usePermissions } from '../../hooks/usePermissions';
import { User } from '../../types/user.types';
import { Role } from '../../types/rbac.types';

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
  password?: string;
  confirmPassword?: string;
  roles: string[];
  isActive: boolean;
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
  const [changePassword, setChangePassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const { canUpdateUsers } = usePermissions();

  // Učitaj role kada se modal otvori
  useEffect(() => {
    if (visible) {
      fetchRoles();
      if (user) {
        form.setFieldsValue({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles || [],
          isActive: user.isActive,
        });
        setChangePassword(false);
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

  const handleSubmit = async (values: EditUserForm) => {
    if (!canUpdateUsers() || !user) {
      message.error('Nemate dozvolu za ažuriranje korisnika');
      return;
    }

    try {
      setLoading(true);

      // Validacija lozinki ako se menjaju
      if (changePassword) {
        if (values.password !== values.confirmPassword) {
          message.error('Lozinke se ne poklapaju');
          return;
        }
        if (!values.password || values.password.length < 6) {
          message.error('Lozinka mora imati najmanje 6 karaktera');
          return;
        }
      }

      // Priprema podataka
      const userData: any = {
        email: values.email.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        isActive: values.isActive,
        roles: values.roles,
      };

      // Dodaj lozinku samo ako se menja
      if (changePassword && values.password) {
        userData.password = values.password;
      }

      await userService.updateUser(user.id, userData);
      
      message.success('Korisnik je uspešno ažuriran');
      form.resetFields();
      setChangePassword(false);
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
    setChangePassword(false);
    onClose();
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

        <Form.Item>
          <Button 
            type="link" 
            onClick={() => setChangePassword(!changePassword)}
            className="p-0"
          >
            {changePassword ? 'Otkaži promenu lozinke' : 'Promeni lozinku'}
          </Button>
        </Form.Item>

        {changePassword && (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="password"
                label="Nova lozinka"
                rules={changePassword ? [
                  { required: true, message: 'Nova lozinka je obavezna' },
                  { min: 6, message: 'Lozinka mora imati najmanje 6 karaktera' },
                ] : []}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Unesite novu lozinku"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label="Potvrdi novu lozinku"
                dependencies={['password']}
                rules={changePassword ? [
                  { required: true, message: 'Potvrda lozinke je obavezna' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Lozinke se ne poklapaju'));
                    },
                  }),
                ] : []}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Potvrdite novu lozinku"
                />
              </Form.Item>
            </Col>
          </Row>
        )}

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