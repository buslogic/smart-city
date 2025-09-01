import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Avatar, 
  Button, 
  Card, 
  message, 
  Upload, 
  Modal, 
  Spin, 
  Tag,
  Row,
  Col,
  Typography,
  Space,
  Divider
} from 'antd';
import { 
  CameraOutlined, 
  UserOutlined, 
  MailOutlined, 
  CalendarOutlined, 
  SafetyOutlined,
  LogoutOutlined,
  LockOutlined,
  DeleteOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/auth.store';
import axios from 'axios';

const { Title, Text } = Typography;

interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  permissions?: string[];
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, token } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/users/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setProfile(response.data);
    } catch (err: any) {
      message.error('Greška pri učitavanju profila');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateImageFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Dozvoljen je samo upload slika (JPEG, PNG, GIF, WebP)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Slika ne sme biti veća od 5MB' };
    }

    return { valid: true };
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Max dimenzije 400x400 za avatar
          const maxWidth = 400;
          const maxHeight = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      message.error(validation.error!);
      return;
    }

    setIsUploading(true);

    try {
      const compressedBase64 = await compressImage(file);
      
      const formData = new FormData();
      // Konvertuj base64 u blob
      const response = await fetch(compressedBase64);
      const blob = await response.blob();
      formData.append('file', blob, 'avatar.jpg');
      formData.append('folder', 'avatars');
      formData.append('isPublic', 'true');
      
      // Upload na Spaces
      const uploadResponse = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/spaces/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Ažuriraj profil sa URL-om avatara
      const profileResponse = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/users/profile/avatar`,
        { avatarUrl: uploadResponse.data.file.url },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      setProfile(profileResponse.data);
      message.success('Avatar uspešno ažuriran');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      message.error(err.message || 'Greška pri upload-u slike');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    Modal.confirm({
      title: 'Uklanjanje avatara',
      content: 'Da li ste sigurni da želite da uklonite avatar?',
      okText: 'Da, ukloni',
      cancelText: 'Otkaži',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await axios.delete(
            `${import.meta.env.VITE_API_URL}/api/users/profile/avatar`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          setProfile(response.data);
          message.success('Avatar uspešno uklonjen');
        } catch (err: any) {
          message.error('Greška pri uklanjanju avatara');
          console.error(err);
        }
      },
    });
  };

  const handleLogout = () => {
    Modal.confirm({
      title: 'Odjava',
      content: 'Da li ste sigurni da želite da se odjavite?',
      okText: 'Da, odjavi me',
      cancelText: 'Otkaži',
      onOk: async () => {
        await logout();
        navigate('/login');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <Text type="secondary">Profil nije pronađen</Text>
      </div>
    );
  }

  const avatarUrl = profile.avatar || undefined;
  const memberSince = new Date(profile.createdAt).toLocaleDateString('sr-RS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const lastLogin = profile.lastLoginAt
    ? new Date(profile.lastLoginAt).toLocaleDateString('sr-RS', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Nikad';

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 -m-6 mb-6 p-6 rounded-t-lg">
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            Moj Profil
          </Title>
        </div>

        {/* Avatar sekcija */}
        <Row gutter={24} className="mb-6">
          <Col span={6}>
            <div className="relative inline-block">
              <Avatar 
                size={128} 
                src={avatarUrl}
                icon={!avatarUrl && <UserOutlined />}
                className="border-4 border-white shadow-lg"
              />
              <div className="absolute bottom-0 right-0 flex space-x-1">
                <Button
                  size="small"
                  type="primary"
                  shape="circle"
                  icon={isUploading ? <LoadingOutlined /> : <CameraOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Promeni avatar"
                />
                {profile.avatar && (
                  <Button
                    size="small"
                    danger
                    shape="circle"
                    icon={<DeleteOutlined />}
                    onClick={handleRemoveAvatar}
                    title="Ukloni avatar"
                  />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </Col>
          
          <Col span={18}>
            <Title level={3}>
              {profile.firstName} {profile.lastName}
            </Title>
            <Text type="secondary">{profile.email}</Text>
            
            <div className="mt-3">
              <Space wrap>
                {profile.roles?.map((role) => (
                  <Tag key={role} color="blue" icon={<SafetyOutlined />}>
                    {role}
                  </Tag>
                )) || (
                  <Tag color="default" icon={<SafetyOutlined />}>
                    Nema dodeljenih rola
                  </Tag>
                )}
              </Space>
            </div>
          </Col>
        </Row>

        <Divider />

        {/* Informacije */}
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12}>
            <Space>
              <UserOutlined className="text-gray-400" />
              <div>
                <Text type="secondary">Ime i prezime</Text>
                <br />
                <Text strong>{profile.firstName} {profile.lastName}</Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Space>
              <MailOutlined className="text-gray-400" />
              <div>
                <Text type="secondary">Email adresa</Text>
                <br />
                <Text strong>{profile.email}</Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Space>
              <CalendarOutlined className="text-gray-400" />
              <div>
                <Text type="secondary">Član od</Text>
                <br />
                <Text strong>{memberSince}</Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Space>
              <CalendarOutlined className="text-gray-400" />
              <div>
                <Text type="secondary">Poslednja prijava</Text>
                <br />
                <Text strong>{lastLogin}</Text>
              </div>
            </Space>
          </Col>
        </Row>

        <Divider />

        {/* Akcije */}
        <Space>
          <Button 
            icon={<LockOutlined />}
            onClick={() => navigate('/change-password')}
          >
            Promeni lozinku
          </Button>
          
          <Button 
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            Odjavi se
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default Profile;