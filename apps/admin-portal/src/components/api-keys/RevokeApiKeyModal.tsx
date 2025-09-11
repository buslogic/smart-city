import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Alert, 
  Typography,
  Space 
} from 'antd';
import { AlertTriangle } from 'lucide-react';
import TextArea from 'antd/es/input/TextArea';
import { apiKeysService, type ApiKey } from '../../services/api-keys.service';

const { Text } = Typography;

interface RevokeApiKeyModalProps {
  open: boolean;
  apiKey: ApiKey | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface RevokeApiKeyForm {
  reason: string;
}

const RevokeApiKeyModal: React.FC<RevokeApiKeyModalProps> = ({
  open,
  apiKey,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: RevokeApiKeyForm) => {
    if (!apiKey) return;

    setLoading(true);
    try {
      await apiKeysService.revoke(apiKey.id, { reason: values.reason });
      onSuccess();
      
    } catch (error: any) {
      console.error('Greška pri opozivu API ključa:', error);
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
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Opoziv API ključa
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
    >
      <div className="space-y-4">
        <Alert
          message="Opozorenje: Nepovratna akcija"
          description="Opoziv API ključa je nepovratna akcija. Ključ neće moći više da se koristi."
          type="warning"
          showIcon
        />

        {apiKey && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div>
              <Text strong className="block mb-1">{apiKey.name}</Text>
              <div className="text-sm text-gray-600">
                <div>Tip: {getTypeLabel(apiKey.type)}</div>
                <div>Ključ: ...{apiKey.displayKey}</div>
                <div>Kreiran: {new Date(apiKey.createdAt).toLocaleDateString('sr-RS')}</div>
                <div>Poslednje korišćenje: {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString('sr-RS') : 'Nikad'}</div>
                <div>Broj korišćenja: {apiKey.usageCount}</div>
              </div>
            </div>
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="reason"
            label="Razlog opoziva"
            rules={[
              { required: true, message: 'Razlog je obavezan' },
              { min: 10, message: 'Razlog mora biti najmanje 10 karaktera' }
            ]}
          >
            <TextArea 
              rows={3} 
              placeholder="Opišite razlog za opoziv ovog API ključa..."
            />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={handleClose}>
              Otkaži
            </Button>
            <Button 
              type="primary" 
              danger 
              htmlType="submit" 
              loading={loading}
            >
              Opozovi ključ
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default RevokeApiKeyModal;