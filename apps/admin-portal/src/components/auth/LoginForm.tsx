import React from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth.store';
import { LoginRequest } from '../../types/auth';

const { Title, Text } = Typography;

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (values: LoginRequest) => {
    try {
      clearError();
      await login(values);
      onSuccess?.();
    } catch (error) {
      // Error je već handled u store-u
    }
  };

  const handleFormChange = () => {
    if (error) {
      clearError();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md" variant="borderless">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2">
            Smart City Admin
          </Title>
          <Text type="secondary">
            Prijavite se da pristupite admin panelu
          </Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          onChange={handleFormChange}
          size="large"
          layout="vertical"
          requiredMark={false}
        >
          {error && (
            <Form.Item>
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                onClose={clearError}
              />
            </Form.Item>
          )}

          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Email je obavezan' },
              { type: 'email', message: 'Email mora biti valjan' },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="Email adresa"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Lozinka je obavezna' },
              { min: 6, message: 'Lozinka mora imati najmanje 6 karaktera' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="Lozinka"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button
              type="primary"
              htmlType="submit"
              className="w-full"
              icon={<LoginOutlined />}
              loading={isLoading}
            >
              Prijavi se
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};