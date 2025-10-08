import { api } from './api';

export interface CentralPoint {
  id: number;
  name: string;
  address: string;
  zip: string;
  city: string;
  phone1: string;
  phone2: string;
  email: string;
  boss: string;
  bossPhone: string;
  bossEmail: string;
  mainStationUid: string;
  longitude: string;
  latitude: string;
  comment: string;
  owes: number;
  expects: number;
  saldo: number;
  incomeSettlementTimeframeCp?: string;
  changedBy: string;
  dateTime: string;
  enablejavaapplet: boolean;
  enableticketreturn: number;
  enableticketdelete: boolean;
  enableotherticketscheck: boolean;
  enablejournalcheck: number;
  internalFuel?: boolean | null;
  color: string;
  lineColor: string;
  image?: any;
  imageAndroid?: any;
  customerInfoCloseDeparture?: any;
  customerInfoOpenDeparture?: any;
  validatorCloseDeparture?: any;
  validatorOpenDeparture?: any;
  sendAndroidPinRequestToAdmin: number;
  androidAdmin: number;
  countryId: number;
  countryName?: string | null;
  vatId?: string | null;
  createdAt: string;
  updatedAt: string;
  otherCpView: number;
  dispatchOrderByCp: number;
  active: boolean;
  placeOfTheInvoice?: string | null;
  currentAccount?: string | null;
  currentAccountForPlastic?: string | null;
  depotCode?: string | null;
  creatingZipByGtfsStandard: boolean;
  defaultDeviceListSubgroupId?: number | null;
  legacyTicketingId?: number | null;
  legacyCityId?: number | null;
  syncSource?: string;
}

export interface CreateCentralPointDto {
  name: string;
  address: string;
  zip: string;
  city: string;
  phone1: string;
  phone2: string;
  email: string;
  boss: string;
  bossPhone: string;
  bossEmail: string;
  mainStationUid: string;
  longitude: string;
  latitude: string;
  comment: string;
  owes: number;
  expects: number;
  saldo: number;
  changedBy: string;
  color: string;
  lineColor: string;
  incomeSettlementTimeframeCp?: string;
  enablejavaapplet?: boolean;
  enableticketreturn?: number;
  enableticketdelete?: boolean;
  enableotherticketscheck?: boolean;
  enablejournalcheck?: number;
  internalFuel?: boolean | null;
  image?: any;
  imageAndroid?: any;
  customerInfoCloseDeparture?: any;
  customerInfoOpenDeparture?: any;
  validatorCloseDeparture?: any;
  validatorOpenDeparture?: any;
  sendAndroidPinRequestToAdmin?: number;
  androidAdmin?: number;
  countryId?: number;
  countryName?: string | null;
  vatId?: string | null;
  otherCpView?: number;
  dispatchOrderByCp?: number;
  active?: boolean;
  placeOfTheInvoice?: string | null;
  currentAccount?: string | null;
  currentAccountForPlastic?: string | null;
  depotCode?: string | null;
  creatingZipByGtfsStandard?: boolean;
  defaultDeviceListSubgroupId?: number | null;
}

export type UpdateCentralPointDto = Partial<CreateCentralPointDto>;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
  message: string;
}

class CentralPointsService {
  // ========== GLAVNI SERVER ==========

  async getAllMain(): Promise<CentralPoint[]> {
    const response = await api.get('/api/central-points/main');
    return response.data;
  }

  async getOne(id: number): Promise<CentralPoint> {
    const response = await api.get(`/api/central-points/main/${id}`);
    return response.data;
  }

  async create(data: CreateCentralPointDto): Promise<CentralPoint> {
    const response = await api.post('/api/central-points', data);
    return response.data;
  }

  async update(id: number, data: UpdateCentralPointDto): Promise<CentralPoint> {
    const response = await api.patch(`/api/central-points/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/api/central-points/${id}`);
  }

  // ========== TIKETING SERVER (LEGACY) ==========

  async getAllTicketing(): Promise<any[]> {
    const response = await api.get('/api/central-points/ticketing');
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResult> {
    const response = await api.post('/api/central-points/sync-ticketing');
    return response.data;
  }

  // ========== GRADSKI SERVER (LEGACY) ==========

  async getAllCity(): Promise<any[]> {
    const response = await api.get('/api/central-points/city');
    return response.data;
  }

  async syncFromCity(): Promise<SyncResult> {
    const response = await api.post('/api/central-points/sync-city');
    return response.data;
  }
}

export const centralPointsService = new CentralPointsService();
