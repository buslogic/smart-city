import { api } from './api';

export interface ApiKey {
  id: number;
  displayKey: string;
  name: string;
  description: string;
  type: 'SWAGGER_ACCESS' | 'API_ACCESS' | 'ADMIN_ACCESS' | 'INTEGRATION';
  permissions: string[];
  allowedIps: string[] | null;
  rateLimit: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  usageCount: number;
  isActive: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
  creator: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
  revoker: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyDto {
  name: string;
  description: string;
  type: 'SWAGGER_ACCESS' | 'API_ACCESS' | 'ADMIN_ACCESS' | 'INTEGRATION';
  permissions: string[];
  allowedIps?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface UpdateApiKeyDto {
  name?: string;
  description?: string;
  permissions?: string[];
  allowedIps?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

export interface RevokeApiKeyDto {
  reason: string;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  rawKey: string;
}

export interface ApiKeyLog {
  id: number;
  apiKeyId: number;
  action: string;
  endpoint: string;
  method: string;
  responseCode: number;
  createdAt: string;
}

class ApiKeysService {
  async getAll(userId?: number): Promise<ApiKey[]> {
    const params = userId ? { userId: userId.toString() } : {};
    const response = await api.get<ApiKey[]>('/api/api-keys', { params });
    return response.data;
  }

  async getById(id: number): Promise<ApiKey> {
    const response = await api.get<ApiKey>(`/api/api-keys/${id}`);
    return response.data;
  }

  async create(data: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const response = await api.post<CreateApiKeyResponse>('/api/api-keys', data);
    return response.data;
  }

  async update(id: number, data: UpdateApiKeyDto): Promise<ApiKey> {
    const response = await api.patch<ApiKey>(`/api/api-keys/${id}`, data);
    return response.data;
  }

  async revoke(id: number, data: RevokeApiKeyDto): Promise<ApiKey> {
    const response = await api.post<ApiKey>(`/api/api-keys/${id}/revoke`, data);
    return response.data;
  }

  async getAuditLog(id: number, limit?: number): Promise<ApiKeyLog[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await api.get<ApiKeyLog[]>(`/api/api-keys/${id}/audit-log`, { params });
    return response.data;
  }

  async delete(id: number): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/api/api-keys/${id}`);
    return response.data;
  }
}

export const apiKeysService = new ApiKeysService();