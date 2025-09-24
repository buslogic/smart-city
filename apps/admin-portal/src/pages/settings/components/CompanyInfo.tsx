import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  Input,
  Button,
  message,
  Card,
  Row,
  Col,
  Upload,
  Spin,
  Typography,
  Space,
  Image
} from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  DeleteOutlined,
  BuildOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  GlobalOutlined,
  HomeOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuthStore } from '../../../stores/auth.store';

const { Title, Text } = Typography;

interface CompanyInfoData {
  id?: number;
  companyName: string;
  taxId: string; // PIB
  address: string;
  phone: string;
  email: string;
  bankAccount: string;
  bankName: string;
  website: string;
  logo?: string;
}

const CompanyInfo: React.FC = () => {
  const [form] = Form.useForm();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/settings/company-info`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data) {
        form.setFieldsValue(response.data);
        // Ako logo postoji i počinje sa /, dodaj base URL
        if (response.data.logo) {
          const logoPath = response.data.logo;
          const fullLogoUrl = logoPath.startsWith('http')
            ? logoPath
            : `${import.meta.env.VITE_API_URL}${logoPath}`;
          setLogoUrl(fullLogoUrl);
        } else {
          setLogoUrl(null);
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        // Ne prikazuj grešku za 403, jer je to normalno ako korisnik nema permisiju
        if (error.response?.status !== 403) {
          message.error('Greška pri učitavanju informacija o kompaniji');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const isProduction = () => {
    return import.meta.env.VITE_API_URL?.includes('smart-city.rs') ||
           import.meta.env.MODE === 'production';
  };

  const validateImageFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Dozvoljen je samo upload slika (JPEG, PNG, GIF, SVG)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Logo ne sme biti veći od 5MB' };
    }

    return { valid: true };
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Za SVG ne radimo kompresiju
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Max dimenzije 500x200 za logo
          const maxWidth = 500;
          const maxHeight = 200;
          let width = img.width;
          let height = img.height;

          // Održi aspect ratio
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/png', 0.9));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleLogoUpload = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      message.error(validation.error!);
      return false;
    }

    setUploading(true);

    try {
      let uploadedLogoUrl: string;

      if (isProduction()) {
        // Production: koristi Spaces
        const compressedBase64 = await compressImage(file);
        const response = await fetch(compressedBase64);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, 'logo.png');
        formData.append('folder', 'company-logos');
        formData.append('isPublic', 'true');

        const uploadResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/spaces/upload-logo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              // Ne postavljaj Content-Type, axios će automatski postaviti boundary
            },
          }
        );

        uploadedLogoUrl = uploadResponse.data.file.url;
      } else {
        // Development: koristi lokalni upload
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/uploads/company-logo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              // Ne postavljaj Content-Type, axios će automatski postaviti boundary
            },
          }
        );

        uploadedLogoUrl = uploadResponse.data.file.url;
      }

      // Ako je relativan path, dodaj base URL za prikaz
      const displayUrl = uploadedLogoUrl.startsWith('http')
        ? uploadedLogoUrl
        : `${import.meta.env.VITE_API_URL}${uploadedLogoUrl}`;

      setLogoUrl(displayUrl);
      // Koristi setTimeout da izbegneš circular reference
      setTimeout(() => {
        form.setFieldValue('logo', uploadedLogoUrl);
      }, 0);
      message.success('Logo uspešno uploadovan');

      return false; // Prevent auto upload
    } catch (error) {
      message.error('Greška pri upload-u logotipa');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    form.setFieldValue('logo', null);
  };

  const handleSubmit = async (values: CompanyInfoData) => {
    setSaving(true);
    try {
      // Izvuci samo relativni path ako je pun URL
      let logoPath = logoUrl;
      if (logoUrl && logoUrl.startsWith('http')) {
        const url = new URL(logoUrl);
        logoPath = url.pathname;
      }

      const dataToSave = {
        ...values,
        logo: logoPath
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/settings/company-info`,
        dataToSave,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      message.success('Informacije o kompaniji uspešno sačuvane');
    } catch (error) {
      message.error('Greška pri čuvanju informacija');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <Title level={4} className="mb-6">
        <BuildOutlined className="mr-2" />
        Informacije o kompaniji
      </Title>

      <Text type="secondary" className="block mb-6">
        Ove informacije se koriste prilikom generisanja računa i drugih dokumenata.
      </Text>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Naziv kompanije"
              name="companyName"
              rules={[
                { required: true, message: 'Naziv kompanije je obavezan' },
                { max: 200, message: 'Maksimalno 200 karaktera' }
              ]}
            >
              <Input
                prefix={<BuildOutlined />}
                placeholder="Unesite naziv kompanije"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="PIB"
              name="taxId"
              rules={[
                { required: true, message: 'PIB je obavezan' },
                { pattern: /^\d{9}$/, message: 'PIB mora imati tačno 9 cifara' }
              ]}
            >
              <Input
                prefix={<IdcardOutlined />}
                placeholder="123456789"
                maxLength={9}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24}>
            <Form.Item
              label="Adresa"
              name="address"
              rules={[
                { required: true, message: 'Adresa je obavezna' },
                { max: 300, message: 'Maksimalno 300 karaktera' }
              ]}
            >
              <Input
                prefix={<HomeOutlined />}
                placeholder="Unesite adresu kompanije"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Telefon"
              name="phone"
              rules={[
                { required: true, message: 'Telefon je obavezan' },
                { pattern: /^[+\d\s()-]+$/, message: 'Neispravni format telefona' }
              ]}
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="+381 11 123 4567"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Email je obavezan' },
                { type: 'email', message: 'Neispravni format email adrese' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="info@kompanija.rs"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Bankovni račun"
              name="bankAccount"
              rules={[
                { required: true, message: 'Bankovni račun je obavezan' },
                { pattern: /^[\d-]+$/, message: 'Neispravni format računa' }
              ]}
            >
              <Input
                prefix={<BankOutlined />}
                placeholder="160-123456-78"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="Naziv banke"
              name="bankName"
              rules={[
                { required: true, message: 'Naziv banke je obavezan' },
                { max: 100, message: 'Maksimalno 100 karaktera' }
              ]}
            >
              <Input
                prefix={<BankOutlined />}
                placeholder="Naziv banke"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24}>
            <Form.Item
              label="Website"
              name="website"
              rules={[
                { type: 'url', message: 'Neispravni format URL adrese' },
                { max: 200, message: 'Maksimalno 200 karaktera' }
              ]}
            >
              <Input
                prefix={<GlobalOutlined />}
                placeholder="https://www.kompanija.rs"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24}>
            <Form.Item
              label="Logo kompanije"
              name="logo"
            >
              <Space direction="vertical" className="w-full">
                {logoUrl ? (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <Image
                      src={logoUrl}
                      alt="Company Logo"
                      style={{ maxHeight: 100, maxWidth: 300, display: 'block', marginBottom: '20px' }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
                    />
                    <div>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleRemoveLogo}
                        size="small"
                      >
                        Ukloni logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={handleLogoUpload}
                  >
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploading}
                    >
                      {uploading ? 'Uploadovanje...' : 'Učitaj logo'}
                    </Button>
                  </Upload>
                )}
                <Text type="secondary" className="text-xs">
                  PNG, JPG, GIF ili SVG. Max 2MB. Preporučene dimenzije: 500x200px
                </Text>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            size="large"
          >
            Sačuvaj izmene
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default CompanyInfo;