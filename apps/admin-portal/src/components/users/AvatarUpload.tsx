import React, { useState, useRef } from 'react';
import { Avatar, Button, Upload, message, Spin } from 'antd';
import {
  CameraOutlined,
  UserOutlined,
  DeleteOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { getAvatarUrl, isProduction } from '../../utils/avatar';
import { useAuthStore } from '../../stores/auth.store';
import axios from 'axios';
import { API_URL } from '../../config/runtime';

interface AvatarUploadProps {
  avatarUrl?: string | null;
  size?: number;
  onAvatarChange?: (avatarUrl: string | null) => void;
  disabled?: boolean;
  showRemoveButton?: boolean;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  size = 120,
  onAvatarChange,
  disabled = false,
  showRemoveButton = true,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const { accessToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      let uploadedAvatarUrl: string;

      if (isProduction()) {
        // Production: koristi Spaces
        const compressedBase64 = await compressImage(file);
        const response = await fetch(compressedBase64);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append('file', blob, 'avatar.jpg');
        formData.append('folder', 'avatars');
        formData.append('isPublic', 'true');

        const uploadResponse = await axios.post(
          `${API_URL}/api/spaces/upload-avatar`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        uploadedAvatarUrl = uploadResponse.data.file.url;
      } else {
        // Development: koristi lokalni upload
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await axios.post(
          `${API_URL}/api/uploads/avatar`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        uploadedAvatarUrl = uploadResponse.data.file.url;
      }

      // Pozovi callback sa novim URL-om
      onAvatarChange?.(uploadedAvatarUrl);
      message.success('Avatar uspešno upload-ovan');

      // Resetuj file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Greška pri upload-u avatara:', err);
      message.error(err.response?.data?.message || 'Greška pri upload-u slike');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    onAvatarChange?.(null);
    message.success('Avatar uklonjen');
  };

  const displayAvatarUrl = getAvatarUrl(avatarUrl);

  return (
    <div className="avatar-upload-container">
      <div className="relative inline-block">
        <Avatar
          size={size}
          src={displayAvatarUrl}
          icon={!displayAvatarUrl && <UserOutlined />}
          className="border-4 border-white shadow-lg"
        />
        <div className="absolute bottom-0 right-0 flex gap-1" style={{ zIndex: 10 }}>
          <Button
            size="small"
            type="primary"
            shape="circle"
            icon={isUploading ? <LoadingOutlined /> : <CameraOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || disabled}
            title="Promeni avatar"
          />
          {showRemoveButton && avatarUrl && (
            <Button
              size="small"
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={handleRemoveAvatar}
              disabled={disabled}
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
          disabled={disabled}
        />
      </div>

      {isUploading && (
        <div className="text-center mt-2">
          <Spin size="small" />
          <span className="ml-2 text-sm text-gray-500">Upload u toku...</span>
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;