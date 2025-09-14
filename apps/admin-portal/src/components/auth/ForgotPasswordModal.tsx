import React, { useState } from 'react';
import { Modal, Form, Input, Button, Alert, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { authService } from '../../services/auth.service';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values: { email: string }) => {
    try {
      setLoading(true);
      setError(null);

      await authService.requestPasswordReset(values.email);

      setSubmittedEmail(values.email);
      setIsSubmitted(true);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Greška pri slanju zahteva za resetovanje lozinke');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setIsSubmitted(false);
    setError(null);
    setSubmittedEmail('');
    onClose();
  };

  return (
    <Modal
      title={isSubmitted ? "Email poslat" : "Zaboravljena lozinka"}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={480}
    >
      {!isSubmitted ? (
        <>
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <MailOutlined className="text-2xl text-blue-600" />
            </div>
            <p className="text-gray-600">
              Unesite vašu email adresu i poslaćemo vam instrukcije za resetovanje lozinke.
            </p>
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
          >
            <Form.Item
              name="email"
              label="Email adresa"
              rules={[
                { required: true, message: 'Email je obavezan' },
                { type: 'email', message: 'Unesite valjan email' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="vas@email.com"
                size="large"
                autoFocus
              />
            </Form.Item>

            <Form.Item className="mb-0">
              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  className="flex-1"
                >
                  Otkaži
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className="flex-1"
                >
                  Pošalji instrukcije
                </Button>
              </div>
            </Form.Item>
          </Form>
        </>
      ) : (
        <Result
          status="success"
          title="Instrukcije poslate!"
          subTitle={
            <>
              Ako email <strong>{submittedEmail}</strong> postoji u našem sistemu,
              poslaćemo instrukcije za resetovanje lozinke.
              <br />
              <br />
              Proverite vašu email poštu (i spam folder) u sledećih nekoliko minuta.
            </>
          }
          extra={
            <Button type="primary" onClick={handleClose}>
              Nazad na prijavljivanje
            </Button>
          }
        />
      )}
    </Modal>
  );
};