import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Select, 
  Checkbox, 
  DatePicker, 
  InputNumber, 
  Button, 
  Alert, 
  Typography,
  Space,
  Divider,
  message 
} from 'antd';
import { Key, Copy, Eye, EyeOff } from 'lucide-react';
import TextArea from 'antd/es/input/TextArea';
import { apiKeysService } from '../../services/api-keys.service';

const { Option } = Select;
const { Text, Title } = Typography;

interface CreateApiKeyModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface CreateApiKeyForm {
  name: string;
  description?: string;
  type: 'SWAGGER_ACCESS' | 'API_ACCESS' | 'ADMIN_ACCESS' | 'INTEGRATION';
  permissions: string[];
  allowedIps?: string;
  rateLimit: number;
  expiresAt?: Date;
}

const CreateApiKeyModal: React.FC<CreateApiKeyModalProps> = ({
  open,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const availablePermissions = [
    { value: 'api_keys:view', label: 'Pregled API ključeva' },
    { value: 'api_keys:create', label: 'Kreiranje API ključeva' },
    { value: 'api_keys:update', label: 'Izmena API ključeva' },
    { value: 'api_keys:revoke', label: 'Opoziv API ključeva' },
    { value: 'api_keys:audit', label: 'Pregled audit log-a' },
  ];

  const handleSubmit = async (values: CreateApiKeyForm) => {
    setLoading(true);
    try {
      const createData = {
        name: values.name,
        description: values.description || '',
        type: values.type,
        permissions: values.permissions,
        rateLimit: values.rateLimit,
        allowedIps: values.allowedIps ? values.allowedIps.split(',').map(ip => ip.trim()).filter(ip => ip) : undefined,
        expiresAt: values.expiresAt?.toISOString(),
      };

      const response = await apiKeysService.create(createData);
      setGeneratedKey(response.rawKey);
      message.success('API ključ je uspešno kreiran!');
      
    } catch (error: any) {
      console.error('Greška pri kreiranju API ključa:', error);
      message.error(error.response?.data?.message || 'Greška pri kreiranju API ključa');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      message.success('API ključ je kopiran u clipboard!');
    }
  };

  const handleClose = () => {
    if (generatedKey) {
      onSuccess();
    }
    setGeneratedKey(null);
    setShowKey(false);
    form.resetFields();
    onCancel();
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'SWAGGER_ACCESS':
        return 'Pristup Swagger dokumentaciji';
      case 'API_ACCESS':
        return 'Programski pristup API endpoints';
      case 'ADMIN_ACCESS':
        return 'Administrativne operacije';
      case 'INTEGRATION':
        return 'Integracije sa spoljašnjim servisima';
      default:
        return '';
    }
  };

  if (generatedKey) {
    return (
      <Modal
        title={<div className="flex items-center gap-2"><Key className="w-5 h-5" />API Ključ Kreiran</div>}
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="close" type="primary" onClick={handleClose}>
            Završi
          </Button>
        ]}
        width={600}
      >
        <div className="space-y-4">
          <Alert
            message="Važno: Sačuvajte ključ"
            description="Ovaj ključ će biti prikazan samo jednom. Sačuvajte ga na sigurnom mestu."
            type="warning"
            showIcon
          />

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Text strong>Vaš novi API ključ:</Text>
              <Space>
                <Button 
                  type="text" 
                  icon={showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  onClick={() => setShowKey(!showKey)}
                />
                <Button 
                  type="primary" 
                  size="small"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={handleCopyKey}
                >
                  Kopiraj
                </Button>
              </Space>
            </div>
            <div className="font-mono bg-white p-3 rounded border">
              {showKey ? generatedKey : '•'.repeat(generatedKey.length)}
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p><strong>Sledeći koraci:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Sačuvajte ključ u sigurnom mestu (password manager)</li>
              <li>Koristite ključ u HTTP header-u: <code>X-API-Key: {generatedKey?.substring(0, 20)}...</code></li>
              <li>Testirajte pristup pre zatvaranja ovog prozora</li>
            </ul>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={<div className="flex items-center gap-2"><Key className="w-5 h-5" />Kreiranje novog API ključa</div>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          rateLimit: 1000,
          permissions: [],
        }}
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
            name="type"
            label="Tip ključa"
            rules={[{ required: true, message: 'Tip je obavezan' }]}
          >
            <Select placeholder="Izaberite tip">
              <Option value="SWAGGER_ACCESS">
                <div>
                  <div>Swagger Access</div>
                  <div className="text-xs text-gray-500">
                    {getTypeDescription('SWAGGER_ACCESS')}
                  </div>
                </div>
              </Option>
              <Option value="API_ACCESS">
                <div>
                  <div>API Access</div>
                  <div className="text-xs text-gray-500">
                    {getTypeDescription('API_ACCESS')}
                  </div>
                </div>
              </Option>
              <Option value="ADMIN_ACCESS">
                <div>
                  <div>Admin Access</div>
                  <div className="text-xs text-gray-500">
                    {getTypeDescription('ADMIN_ACCESS')}
                  </div>
                </div>
              </Option>
              <Option value="INTEGRATION">
                <div>
                  <div>Integration</div>
                  <div className="text-xs text-gray-500">
                    {getTypeDescription('INTEGRATION')}
                  </div>
                </div>
              </Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label="Opis (opciono)"
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

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
            Kreiraj ključ
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateApiKeyModal;