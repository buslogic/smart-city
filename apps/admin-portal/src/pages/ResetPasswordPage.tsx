import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { authService } from '../services/auth.service';

const { Title, Text } = Typography;

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Nevažeći ili nedostajući token za resetovanje lozinke');
    }
  }, [token]);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (!token) {
      setError('Token za resetovanje lozinke nije pronađen');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await authService.resetPassword(token, values.password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Greška pri resetovanju lozinke');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4">
        <Card className="w-full max-w-md">
          <Result
            status="success"
            title="Lozinka je uspešno resetovana!"
            subTitle="Preusmeravamo vas na stranicu za prijavljivanje..."
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                Idi na prijavljivanje
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2">
            Resetovanje lozinke
          </Title>
          <Text type="secondary">
            Unesite novu lozinku za vaš nalog
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            className="mb-4"
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={!token}
        >
          <Form.Item
            name="password"
            label="Nova lozinka"
            rules={[
              { required: true, message: 'Lozinka je obavezna' },
              { min: 8, message: 'Lozinka mora imati najmanje 8 karaktera' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                message: 'Lozinka mora sadržati veliko slovo, malo slovo, broj i specijalni karakter'
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Unesite novu lozinku"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Potvrdi lozinku"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Potvrda lozinke je obavezna' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Lozinke se ne poklapaju'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Potvrdite novu lozinku"
              size="large"
            />
          </Form.Item>

          <Form.Item className="mb-2">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full"
              size="large"
            >
              Resetuj lozinku
            </Button>
          </Form.Item>

          <div className="text-center">
            <Button type="link" onClick={() => navigate('/login')}>
              Nazad na prijavljivanje
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};