import { api } from './api';

export interface PriceVariation {
  id: number;
  variationName: string;
  variationDescription: string;
  gtfsRouteSettingsId?: string | null;
  direction?: string | null;
  mainBasicRoute?: boolean | null;
  datetimeFrom?: string | null;
  datetimeTo?: string | null;
  lineTypeId: number;
  updatedAt?: string | null;
  legacyTicketingId?: string | null;
  legacyCityId?: string | null;
}

export interface CreatePriceVariationDto {
  variationName: string;
  variationDescription: string;
  lineTypeId: number;
  gtfsRouteSettingsId?: string;
  direction?: string;
  mainBasicRoute?: boolean;
  datetimeFrom?: string;
  datetimeTo?: string;
  legacyTicketingId?: string;
  legacyCityId?: string;
}

export type UpdatePriceVariationDto = Partial<CreatePriceVariationDto>;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

class PriceVariationsService {
  // ========== GLAVNI SERVER ==========

  async getAllMain(
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<PriceVariation>> {
    const params = { page, limit };
    const response = await api.get('/api/price-variations/main', { params });
    return response.data;
  }

  async getOne(id: number): Promise<PriceVariation> {
    const response = await api.get(`/api/price-variations/main/${id}`);
    return response.data;
  }

  async create(data: CreatePriceVariationDto): Promise<PriceVariation> {
    const response = await api.post('/api/price-variations', data);
    return response.data;
  }

  async update(id: number, data: UpdatePriceVariationDto): Promise<PriceVariation> {
    const response = await api.patch(`/api/price-variations/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/api/price-variations/${id}`);
  }

  // ========== TIKETING SERVER (LEGACY) ==========

  async getAllTicketing(
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params = { page, limit };
    const response = await api.get('/api/price-variations/ticketing', { params });
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResult> {
    const response = await api.post('/api/price-variations/sync-ticketing');
    return response.data;
  }

  // ========== GRADSKI SERVER (LEGACY) ==========

  async getAllCity(
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params = { page, limit };
    const response = await api.get('/api/price-variations/city', { params });
    return response.data;
  }

  async syncFromCity(): Promise<SyncResult> {
    const response = await api.post('/api/price-variations/sync-city');
    return response.data;
  }
}

export const priceVariationsService = new PriceVariationsService();
