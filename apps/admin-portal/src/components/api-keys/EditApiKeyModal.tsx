import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Select, 
  Checkbox, 
  DatePicker, 
  InputNumber, 
  Button, 
  message,
  Divider 
} from 'antd';
import { Edit } from 'lucide-react';
import TextArea from 'antd/es/input/TextArea';
import { apiKeysService, type ApiKey } from '../../services/api-keys.service';
import dayjs from 'dayjs';

const { Option } = Select;

interface EditApiKeyModalProps {
  open: boolean;
  apiKey: ApiKey | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface UpdateApiKeyForm {
  name: string;
  description?: string;
  permissions: string[];
  allowedIps?: string;
  rateLimit: number;
  expiresAt?: dayjs.Dayjs;
}

const EditApiKeyModal: React.FC<EditApiKeyModalProps> = ({
  open,
  apiKey,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const availablePermissions = [
    { value: 'api_keys:view', label: 'Pregled API ključeva' },
    { value: 'api_keys:create', label: 'Kreiranje API ključeva' },
    { value: 'api_keys:update', label: 'Izmena API ključeva' },
    { value: 'api_keys:revoke', label: 'Opoziv API ključeva' },
    { value: 'api_keys:audit', label: 'Pregled audit log-a' },
  ];

  useEffect(() => {
    if (apiKey && open) {
      form.setFieldsValue({
        name: apiKey.name,
        description: apiKey.description,
        permissions: apiKey.permissions,
        allowedIps: apiKey.allowedIps?.join(', ') || '',
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt ? dayjs(apiKey.expiresAt) : undefined,
      });
    }
  }, [apiKey, open, form]);

  const handleSubmit = async (values: UpdateApiKeyForm) => {
    if (!apiKey) return;

    setLoading(true);
    try {
      const updateData = {
        name: values.name,
        description: values.description || '',
        permissions: values.permissions,
        rateLimit: values.rateLimit,
        allowedIps: values.allowedIps ? values.allowedIps.split(',').map(ip => ip.trim()).filter(ip => ip) : undefined,
        expiresAt: values.expiresAt?.toISOString(),
      };

      await apiKeysService.update(apiKey.id, updateData);
      message.success('API ključ je uspešno ažuriran!');
      onSuccess();
      
    } catch (error: any) {
      console.error('Greška pri ažuriranju API ključa:', error);
      message.error(error.response?.data?.message || 'Greška pri ažuriranju API ključa');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onCancel();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SWAGGER_ACCESS': return 'Swagger Access';
      case 'API_ACCESS': return 'API Access';
      case 'ADMIN_ACCESS': return 'Admin Access';
      case 'INTEGRATION': return 'Integration';
      default: return type;
    }
  };

  return (
    <Modal
      title={<div className="flex items-center gap-2"><Edit className="w-5 h-5" />Izmena API ključa</div>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      {apiKey && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{apiKey.name}</div>
              <div className="text-sm text-gray-600">
                Tip: {getTypeLabel(apiKey.type)} | Ključ: ...{apiKey.displayKey}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Kreiran: {new Date(apiKey.createdAt).toLocaleDateString('sr-RS')}
            </div>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="name"
            label="Naziv ključa"
            rules={[{ required: true, message: 'Naziv je obavezan' }]}
          >
            <Input placeholder="npr. Production API Access" />
          </Form.Item>

          <Form.Item
            name="rateLimit"
            label="Rate Limit (zahtevi po satu)"
            rules={[{ required: true, message: 'Rate limit je obavezan' }]}
          >
            <InputNumber 
              min={1}
              max={10000}
              style={{ width: '100%' }}
              placeholder="1000"
            />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label="Opis"
        >
          <TextArea 
            rows={2} 
            placeholder="Opišite namenu ovog ključa..."
          />
        </Form.Item>

        <Divider orientation="left">Dozvole</Divider>

        <Form.Item
          name="permissions"
          label="Permisije"
          rules={[{ required: true, message: 'Izaberite barem jednu permisiju' }]}
        >
          <Checkbox.Group>
            <div className="grid grid-cols-2 gap-2">
              {availablePermissions.map(perm => (
                <Checkbox key={perm.value} value={perm.value}>
                  {perm.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>

        <Divider orientation="left">Ograničenja</Divider>

        <Form.Item
          name="expiresAt"
          label="Ističe (opciono)"
        >
          <DatePicker 
            style={{ width: '100%' }}
            placeholder="Izaberite datum"
            showTime
            format="DD.MM.YYYY HH:mm"
          />
        </Form.Item>

        <Form.Item
          name="allowedIps"
          label="Dozvoljene IP adrese (opciono)"
          help="Lista IP adresa odvojena zarezom. Ostavi prazno za sve IP adrese."
        >
          <TextArea
            rows={2}
            placeholder="192.168.1.100, 10.0.0.5, 172.16.0.10"
          />
        </Form.Item>

        <div className="flex justify-end space-x-2 pt-4">
          <Button onClick={handleClose}>
            Otkaži
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Sačuvaj izmene
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EditApiKeyModal;