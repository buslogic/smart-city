import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Button,
  Alert,
  Descriptions,
  Tag,
  Spin,
  message,
  Typography,
} from 'antd';
import {
  SettingOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  UserOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import { userService } from '../../services/userService';

const { Text, Title } = Typography;
const { Option } = Select;

interface RoleSyncSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Role {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

interface SyncSettings {
  defaultRoleId: number | null;
  defaultRole: {
    id: number;
    name: string;
    description: string;
  } | null;
  configured: boolean;
}

export const RoleSyncSettingsModal: React.FC<RoleSyncSettingsModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentSettings, setCurrentSettings] = useState<SyncSettings | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      form.resetFields();
      setSelectedRoleId(null);
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load available roles and current settings in parallel
      const [rolesResponse, settingsResponse] = await Promise.all([
        userService.getAllRoles(),
        userService.getSyncSettings(),
      ]);

      // Filter only active roles
      const activeRoles = rolesResponse.filter((role: Role) => role.isActive);
      setRoles(activeRoles);
      setCurrentSettings(settingsResponse);

      // Set form initial value
      if (settingsResponse.defaultRoleId) {
        form.setFieldsValue({
          defaultRoleId: settingsResponse.defaultRoleId,
        });
        setSelectedRoleId(settingsResponse.defaultRoleId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri učitavanju podataka');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: { defaultRoleId: number }) => {
    setSaving(true);
    try {
      await userService.updateSyncSettings(values.defaultRoleId);
      message.success('Podešavanja uspešno sačuvana');
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri čuvanju podešavanja');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedRoleId(null);
    onClose();
  };

  const selectedRole = roles.find(role => role.id === selectedRoleId);

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <SettingOutlined />
          <span>Podešavanja sinhronizacije korisnika</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Otkaži
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => form.submit()}
          loading={saving}
          disabled={!selectedRoleId}
        >
          Sačuvaj
        </Button>,
      ]}
      width={600}
    >
      {loading ? (
        <div className="text-center py-12">
          <Spin size="large" tip="Učitavanje podataka..." />
        </div>
      ) : (
        <>
          <Alert
            message="Konfigurisanje default role"
            description="Odaberite rolu koja će automatski biti dodeljena svim korisnicima sinhronizovanim iz legacy baze."
            type="info"
            showIcon
            icon={<SecurityScanOutlined />}
            className="mb-6"
          />

          {/* Current settings */}
          {currentSettings && (
            <div className="mb-6">
              <Title level={5}>Trenutno stanje</Title>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Status konfiguracije">
                  {currentSettings.configured ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      Konfigurirana
                    </Tag>
                  ) : (
                    <Tag color="red">Nije konfigurirana</Tag>
                  )}
                </Descriptions.Item>
                {currentSettings.defaultRole && (
                  <>
                    <Descriptions.Item label="Trenutna default rola">
                      <Tag color="blue" icon={<UserOutlined />}>
                        {currentSettings.defaultRole.name}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Opis role">
                      {currentSettings.defaultRole.description}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </div>
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            <Form.Item
              name="defaultRoleId"
              label="Default rola za sinhronizovane korisnike"
              rules={[
                { required: true, message: 'Molimo odaberite default rolu' },
              ]}
            >
              <Select
                placeholder="Odaberite rolu..."
                size="large"
                showSearch
                onChange={(value) => setSelectedRoleId(value)}
                filterOption={(input, option) =>
                  (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {roles.map(role => (
                  <Option key={role.id} value={role.id}>
                    <div className="flex justify-between items-center">
                      <span>
                        <UserOutlined className="mr-2" />
                        {role.name}
                      </span>
                      <Text type="secondary" className="text-sm">
                        {role.description}
                      </Text>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Preview selected role */}
            {selectedRole && (
              <Alert
                message="Odabrana rola"
                description={
                  <div>
                    <Text strong>{selectedRole.name}</Text>
                    <br />
                    <Text>{selectedRole.description}</Text>
                  </div>
                }
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                className="mt-4"
              />
            )}
          </Form>

          <Alert
            message="Napomena"
            description={
              <ul className="mb-0 pl-4">
                <li>Ova rola će biti automatski dodeljena svim novim korisnicima tokom sinhronizacije</li>
                <li>Postojeći sinhronizovani korisnici neće biti menjani</li>
                <li>Možete promeniti ovo podešavanje u bilo kom momentu</li>
                <li>Prikazane su samo aktivne role</li>
              </ul>
            }
            type="warning"
            showIcon
            className="mt-6"
          />
        </>
      )}
    </Modal>
  );
};