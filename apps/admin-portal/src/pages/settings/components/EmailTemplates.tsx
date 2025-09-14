import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Switch,
  Tooltip,
  Card,
  Row,
  Col,
  Typography,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  CopyOutlined,
  ReloadOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { usePermissions } from '../../../hooks/usePermissions';
import { api } from '../../../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  category: string;
  variables?: string[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string;
  creator?: {
    firstName: string;
    lastName: string;
  };
  updater?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

const EmailTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [form] = Form.useForm();
  const { hasPermission } = usePermissions();

  const categories = [
    { value: 'authentication', label: 'Autentifikacija' },
    { value: 'notification', label: 'Notifikacije' },
    { value: 'report', label: 'Izveštaji' },
    { value: 'alert', label: 'Upozorenja' },
    { value: 'general', label: 'Opšte' },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/email-templates');
      setTemplates(response.data);
    } catch (error: any) {
      message.error('Greška pri učitavanju email šablona');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    form.setFieldsValue({
      category: 'general',
      isActive: true,
      variables: [],
    });
    setModalVisible(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      ...template,
      variables: template.variables?.join(', ') || '',
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/email-templates/${id}`);
      message.success('Email šablon je uspešno obrisan');
      fetchTemplates();
    } catch (error: any) {
      message.error('Greška pri brisanju email šablona');
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await api.post(`/api/email-templates/${template.id}/toggle-active`);
      message.success(`Šablon je ${template.isActive ? 'deaktiviran' : 'aktiviran'}`);
      fetchTemplates();
    } catch (error: any) {
      message.error('Greška pri promeni statusa šablona');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // Parse variables
      const variables = values.variables
        ? values.variables.split(',').map((v: string) => v.trim()).filter((v: string) => v)
        : [];

      const data = {
        ...values,
        variables,
      };

      if (editingTemplate) {
        await api.patch(`/api/email-templates/${editingTemplate.id}`, data);
        message.success('Email šablon je uspešno ažuriran');
      } else {
        await api.post('/api/email-templates', data);
        message.success('Email šablon je uspešno kreiran');
      }

      setModalVisible(false);
      fetchTemplates();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Greška pri čuvanju email šablona');
    }
  };

  const handleTest = (template: EmailTemplate) => {
    setTestingTemplate(template);
    setTestEmail('');
    setTestModalVisible(true);
  };

  const handleSendTest = async () => {
    if (!testEmail || !testingTemplate) return;

    try {
      await api.post(`/api/email-templates/${testingTemplate.id}/test`, {
        testEmail,
      });
      message.success(`Test email je poslat na ${testEmail}`);
      setTestModalVisible(false);
    } catch (error: any) {
      message.error('Greška pri slanju test emaila');
    }
  };

  const handleCopySlug = (slug: string) => {
    navigator.clipboard.writeText(slug);
    message.success('Slug je kopiran u clipboard');
  };

  const columns = [
    {
      title: 'Naziv',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: EmailTemplate) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.slug}
            </Text>
            <Tooltip title="Kopiraj slug">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopySlug(record.slug)}
              />
            </Tooltip>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Kategorija',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => {
        const cat = categories.find(c => c.value === category);
        return <Tag color="blue">{cat?.label || category}</Tag>;
      },
    },
    {
      title: 'Predmet',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center' as const,
      render: (isActive: boolean, record: EmailTemplate) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          disabled={!hasPermission('settings.email_templates:update')}
        />
      ),
    },
    {
      title: 'Korišćeno',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'default'}>{count}</Tag>
      ),
    },
    {
      title: 'Poslednje korišćeno',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleDateString('sr-RS') : '-',
    },
    {
      title: 'Akcije',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: EmailTemplate) => (
        <Space>
          {hasPermission('settings.email_templates:test') && (
            <Tooltip title="Testiraj">
              <Button
                type="text"
                icon={<SendOutlined />}
                onClick={() => handleTest(record)}
              />
            </Tooltip>
          )}
          {hasPermission('settings.email_templates:update') && (
            <Tooltip title="Izmeni">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {hasPermission('settings.email_templates:delete') && (
            <Popconfirm
              title="Da li ste sigurni da želite da obrišete ovaj šablon?"
              onConfirm={() => handleDelete(record.id)}
              okText="Da"
              cancelText="Ne"
            >
              <Tooltip title="Obriši">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <MailOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Email Šabloni</Title>
                <Text type="secondary">Upravljanje email šablonima za sistemske poruke</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchTemplates}
              >
                Osveži
              </Button>
              {hasPermission('settings.email_templates:create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                >
                  Novi Šablon
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Ukupno ${total} šablona`,
        }}
      />

      <Modal
        title={editingTemplate ? 'Izmeni Email Šablon' : 'Novi Email Šablon'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Naziv"
                rules={[{ required: true, message: 'Naziv je obavezan' }]}
              >
                <Input placeholder="npr. Dobrodošli Email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="slug"
                label="Slug (jedinstveni identifikator)"
                rules={[
                  { required: true, message: 'Slug je obavezan' },
                  { pattern: /^[a-z0-9-]+$/, message: 'Slug može sadržati samo mala slova, brojeve i crtice' }
                ]}
              >
                <Input placeholder="npr. welcome-email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Kategorija"
                rules={[{ required: true, message: 'Kategorija je obavezna' }]}
              >
                <Select>
                  {categories.map(cat => (
                    <Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isActive"
                label="Aktivan"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="subject"
            label="Predmet emaila"
            rules={[{ required: true, message: 'Predmet je obavezan' }]}
          >
            <Input placeholder="npr. Dobrodošli u {{appName}}" />
          </Form.Item>

          <Form.Item
            name="variables"
            label="Varijable (odvojene zarezom)"
            help="npr. firstName, lastName, email, resetUrl"
          >
            <Input placeholder="firstName, lastName, email" />
          </Form.Item>

          <Form.Item
            name="body"
            label="Sadržaj (Plain Text)"
            rules={[{ required: true, message: 'Sadržaj je obavezan' }]}
          >
            <TextArea
              rows={8}
              placeholder="Pozdrav {{firstName}},&#10;&#10;Dobrodošli..."
            />
          </Form.Item>

          <Form.Item
            name="bodyHtml"
            label="HTML Sadržaj (opciono)"
          >
            <TextArea
              rows={8}
              placeholder="<p>Pozdrav {{firstName}},</p>..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? 'Ažuriraj' : 'Kreiraj'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Otkaži
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Test Email: ${testingTemplate?.name}`}
        open={testModalVisible}
        onOk={handleSendTest}
        onCancel={() => setTestModalVisible(false)}
        okText="Pošalji"
        cancelText="Otkaži"
      >
        <Form layout="vertical">
          <Form.Item
            label="Email adresa za test"
            required
          >
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </Form.Item>
          {testingTemplate && (
            <Card size="small" className="mt-3">
              <Paragraph>
                <Text strong>Predmet:</Text> {testingTemplate.subject}
              </Paragraph>
              <Paragraph>
                <Text strong>Varijable:</Text>{' '}
                {testingTemplate.variables?.join(', ') || 'Nema varijabli'}
              </Paragraph>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Test email će biti poslat sa primerima podataka za sve varijable
              </Text>
            </Card>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default EmailTemplates;