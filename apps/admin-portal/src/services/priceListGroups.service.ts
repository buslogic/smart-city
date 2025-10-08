import { api } from './api';

export interface PriceListGroup {
  id: string; // BigInt iz backend-a dolazi kao string
  dateValidFrom: string;
  status: string;
  synchroStatus: string;
  sendIncremental: string;
  changedBy: string;
  dateTime: string;
  name: string;
  legacyTicketingId?: string | null;
  legacyCityId?: string | null;
}

export interface CreatePriceListGroupDto {
  dateValidFrom: string;
  status?: string;
  synchroStatus?: string;
  sendIncremental?: string;
  changedBy: string;
  name: string;
}

export type UpdatePriceListGroupDto = Partial<CreatePriceListGroupDto>;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
  message: string;
}

class PriceListGroupsService {
  // ========== GLAVNI SERVER ==========

  async getAllMain(): Promise<PriceListGroup[]> {
    const response = await api.get('/api/price-list-groups/main');
    return response.data;
  }

  async getOne(id: number): Promise<PriceListGroup> {
    const response = await api.get(`/api/price-list-groups/main/${id}`);
    return response.data;
  }

  async create(data: CreatePriceListGroupDto): Promise<PriceListGroup> {
    const response = await api.post('/api/price-list-groups', data);
    return response.data;
  }

  async update(
    id: number,
    data: UpdatePriceListGroupDto,
  ): Promise<PriceListGroup> {
    const response = await api.patch(`/api/price-list-groups/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/api/price-list-groups/${id}`);
  }

  // ========== TIKETING SERVER (LEGACY) ==========

  async getAllTicketing(): Promise<any[]> {
    const response = await api.get('/api/price-list-groups/ticketing');
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResult> {
    const response = await api.post('/api/price-list-groups/sync-ticketing');
    return response.data;
  }

  // ========== GRADSKI SERVER (LEGACY) ==========

  async getAllCity(): Promise<any[]> {
    const response = await api.get('/api/price-list-groups/city');
    return response.data;
  }

  async syncFromCity(): Promise<SyncResult> {
    const response = await api.post('/api/price-list-groups/sync-city');
    return response.data;
  }
}

export const priceListGroupsService = new PriceListGroupsService();
