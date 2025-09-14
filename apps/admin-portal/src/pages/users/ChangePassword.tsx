import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider, Row, Col } from 'antd';
import { LockOutlined, CheckCircleFilled, CloseCircleFilled, ArrowLeftOutlined } from '@ant-design/icons';
import { authService } from '../../services/auth.service';
import { message } from 'antd';

const { Title, Text } = Typography;

interface PasswordStrength {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

const PasswordRequirement: React.FC<{ isValid: boolean; text: string }> = ({ isValid, text }) => {
  return (
    <div className="flex items-center gap-2 text-xs">
      {isValid ? (
        <CheckCircleFilled className="text-green-500" />
      ) : (
        <CloseCircleFilled className="text-gray-300" />
      )}
      <span className={isValid ? 'text-green-600 font-medium' : 'text-gray-500'}>
        {text}
      </span>
    </div>
  );
};

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const passwordStrength: PasswordStrength = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[@$!%*?&]/.test(newPassword),
  };

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      await authService.changePassword(values.currentPassword, values.newPassword);

      message.success('Lozinka je uspešno promenjena!');

      // Clear form
      form.resetFields();
      setNewPassword('');

      // Redirect to profile after 2 seconds
      setTimeout(() => {
        navigate('/users/profile');
      }, 2000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Greška pri promeni lozinke';
      setError(errorMessage);

      // Ako je trenutna lozinka pogrešna, fokusiraj to polje
      if (errorMessage.toLowerCase().includes('trenutna') || errorMessage.toLowerCase().includes('current')) {
        form.getFieldInstance('currentPassword')?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/users/profile')}
          type="link"
          className="mb-4 p-0"
        >
          Nazad na profil
        </Button>

        <Title level={2} className="!mb-2">
          Promena lozinke
        </Title>
        <Text type="secondary">
          Promenite lozinku za vaš nalog. Nova lozinka mora ispunjavati sve sigurnosne zahteve.
        </Text>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
            >
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

              <Form.Item
                name="currentPassword"
                label="Trenutna lozinka"
                rules={[
                  { required: true, message: 'Trenutna lozinka je obavezna' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Unesite trenutnu lozinku"
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Divider />

              <Form.Item
                name="newPassword"
                label="Nova lozinka"
                rules={[
                  { required: true, message: 'Nova lozinka je obavezna' },
                  { min: 8, message: 'Lozinka mora imati najmanje 8 karaktera' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value) return Promise.resolve();

                      if (value === getFieldValue('currentPassword')) {
                        return Promise.reject(new Error('Nova lozinka mora biti različita od trenutne'));
                      }

                      if (!isPasswordStrong) {
                        return Promise.reject(new Error('Lozinka mora ispunjavati sve sigurnosne zahteve'));
                      }

                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Unesite novu lozinku"
                  size="large"
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Potvrdi novu lozinku"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Potvrda lozinke je obavezna' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
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
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Space className="w-full">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    disabled={!isPasswordStrong}
                  >
                    Promeni lozinku
                  </Button>
                  <Button
                    onClick={() => navigate('/users/profile')}
                    size="large"
                  >
                    Otkaži
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="Sigurnosni zahtevi"
            className="sticky top-6"
            headStyle={{ borderBottom: '1px solid #f0f0f0' }}
          >
            <div className="space-y-3">
              <Text type="secondary" className="block mb-4">
                Nova lozinka mora ispunjavati sve navedene zahteve:
              </Text>

              <PasswordRequirement
                isValid={passwordStrength.length}
                text="Najmanje 8 karaktera"
              />
              <PasswordRequirement
                isValid={passwordStrength.uppercase}
                text="Najmanje jedno veliko slovo (A-Z)"
              />
              <PasswordRequirement
                isValid={passwordStrength.lowercase}
                text="Najmanje jedno malo slovo (a-z)"
              />
              <PasswordRequirement
                isValid={passwordStrength.number}
                text="Najmanje jedan broj (0-9)"
              />
              <PasswordRequirement
                isValid={passwordStrength.special}
                text="Najmanje jedan specijalni karakter (@$!%*?&)"
              />
            </div>

            <Divider />

            <Alert
              message="Saveti za sigurnu lozinku"
              description={
                <ul className="mt-2 ml-4 space-y-1 text-xs">
                  <li>Ne koristite lične podatke (ime, datum rođenja)</li>
                  <li>Ne koristite istu lozinku na više mesta</li>
                  <li>Koristite kombinaciju reči koje možete zapamtiti</li>
                  <li>Redovno menjajte lozinku (svakih 3-6 meseci)</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}