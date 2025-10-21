import { api } from './api';

export interface Line {
  id: string; // BigInt iz backend-a dolazi kao string
  lineNumber: string;
  actualLineNumber: string;
  lineTitle: string;
  lineTitleReturn: string;
  rootLineNumber: string;
  lineNumberForDisplay: string;
  circleRoute: boolean;
  directionIdForDisplay: string;
  lineTitleForDisplay: string;
  lineNumberForSite: string;
  furl: string;
  toPlace: string;
  toPlaceTwo: string;
  numOfDirection: number;
  officialDeparture: string;
  dateValidFrom: string;
  priceTableIdent: string;
  monthlyPriceTableIdent: string;
  subversion: string;
  numberOfStations: number;
  vatFromTaxTable: string;
  vatId: string;
  vatValue: string;
  discountTariffTableIdent: string;
  regionTableIdent: string;
  zoneTableIdent: string;
  distanceTableIdent: string;
  citiesTableIdent: string;
  lineTypeId: number;
  lineType: string;
  changedSinceSync: string;
  changeLog: string;
  changeIncremental: string;
  centralPointDbId: string;
  centralPointName: string;
  changedBy: string;
  dateTime: string;
  status: string;
  busOperator: number;
  displayByDispachPlanning: boolean;
  lineRoute: string;
  lineRoute1: string;
  bestfrom: string | null;
  gLineRoute: string;
  gLineRoute1: string;
  maxSpeed: number;
  timeAllowed: number;
  isolatedExportsAccountingSoftware: boolean;
  daysSellInAdvance: number;
  roundPrice: number;
  bestFromRet: string;
  daysSellInAdvanceRet: number;
  bestTo: string;
  bestToRet: string;
  checkInAmount: string;
  pricePerKm: string;
  additionalLineTypeId: number;
  usedInDispech: boolean;
  showOnNet: boolean;
  showOnNetCity: boolean;
  netPricelistId: number;
  payOnDelivery: string;
  mobilePhone: string;
  creditCard: string;
  usedInBooking: boolean;
  startTerminusKm: string;
  endTerminusKm: string;
  rvSaleFlag: boolean;
  rvLineSource: number;
  qrValidations: number;
  qrValidationsReturn: number;
  qrValidationsDir1: number;
  qrValidationsReturnDir1: number;
  transientPriceSetting: number;
  sellWithoutSeatNo: boolean;
  alwaysExportFlag: boolean;
  minModeSecurity: number;
  allowedMin: number;
  mainLineFromGroup: string;
  routeCode: string;
  gtfsRouteId: number;
  priceVariationId: number;
  wrongDirectionType: number;
  gtfsShapeId: string;
  descriptionOfStreetsGtfs: string;
  usedInDateShedule: boolean;
  lineKmMeanValueWithBusTerminus: string;
  systemTypesId: number;
  categoriesLineId: number;
  timeFromByLine: string;
  timeToByLine: string;
  onlineDiscountType: string;
  showOnWeb: boolean;
  showOnAndroid: boolean;
  legacyTicketingId?: string | null;
  legacyCityId?: string | null;
}

export interface CreateLineDto {
  lineNumber: string;
  actualLineNumber: string;
  lineTitle: string;
  dateValidFrom: string;
  priceTableIdent: string;
  systemTypesId: number;
  categoriesLineId: number;
  changedBy: string;

  // Opcionalna polja
  lineTitleReturn?: string;
  rootLineNumber?: string;
  lineNumberForDisplay?: string;
  circleRoute?: boolean;
  directionIdForDisplay?: string;
  lineTitleForDisplay?: string;
  lineNumberForSite?: string;
  furl?: string;
  toPlace?: string;
  toPlaceTwo?: string;
  numOfDirection?: number;
  officialDeparture?: string;
  monthlyPriceTableIdent?: string;
  subversion?: string;
  numberOfStations?: number;
  vatFromTaxTable?: string;
  vatId?: string;
  vatValue?: string;
  discountTariffTableIdent?: string;
  regionTableIdent?: string;
  zoneTableIdent?: string;
  distanceTableIdent?: string;
  citiesTableIdent?: string;
  lineTypeId?: number;
  lineType?: string;
  changedSinceSync?: string;
  changeLog?: string;
  changeIncremental?: string;
  centralPointDbId?: string;
  centralPointName?: string;
  status?: string;
  busOperator?: number;
  displayByDispachPlanning?: boolean;
  lineRoute?: string;
  lineRoute1?: string;
  bestfrom?: string;
  gLineRoute?: string;
  gLineRoute1?: string;
  maxSpeed?: number;
  timeAllowed?: number;
  isolatedExportsAccountingSoftware?: boolean;
  daysSellInAdvance?: number;
  roundPrice?: number;
  bestFromRet?: string;
  daysSellInAdvanceRet?: number;
  bestTo?: string;
  bestToRet?: string;
  checkInAmount?: string;
  pricePerKm?: string;
  additionalLineTypeId?: number;
  usedInDispech?: boolean;
  showOnNet?: boolean;
  showOnNetCity?: boolean;
  netPricelistId?: number;
  payOnDelivery?: string;
  mobilePhone?: string;
  creditCard?: string;
  usedInBooking?: boolean;
  startTerminusKm?: string;
  endTerminusKm?: string;
  rvSaleFlag?: boolean;
  rvLineSource?: number;
  qrValidations?: number;
  qrValidationsReturn?: number;
  qrValidationsDir1?: number;
  qrValidationsReturnDir1?: number;
  transientPriceSetting?: number;
  sellWithoutSeatNo?: boolean;
  alwaysExportFlag?: boolean;
  minModeSecurity?: number;
  allowedMin?: number;
  mainLineFromGroup?: string;
  routeCode?: string;
  gtfsRouteId?: number;
  priceVariationId?: number;
  wrongDirectionType?: number;
  gtfsShapeId?: string;
  descriptionOfStreetsGtfs?: string;
  usedInDateShedule?: boolean;
  lineKmMeanValueWithBusTerminus?: string;
  timeFromByLine?: string;
  timeToByLine?: string;
  onlineDiscountType?: string;
  showOnWeb?: boolean;
  showOnAndroid?: boolean;
}

export type UpdateLineDto = Partial<CreateLineDto>;

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  totalProcessed: number;
  message: string;
}

export interface LineUidsSyncResult {
  success: boolean;
  tableName: string;
  tableCreated: boolean;
  totalRecords: number;
  inserted: number;
  duration: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

class LinesService {
  // ========== GLAVNI SERVER ==========

  async getAllMain(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<Line>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get('/api/lines/main', { params });
    return response.data;
  }

  async getOne(id: number): Promise<Line> {
    const response = await api.get(`/api/lines/main/${id}`);
    return response.data;
  }

  async create(data: CreateLineDto): Promise<Line> {
    const response = await api.post('/api/lines', data);
    return response.data;
  }

  async update(id: number, data: UpdateLineDto): Promise<Line> {
    const response = await api.patch(`/api/lines/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/api/lines/${id}`);
  }

  // ========== TIKETING SERVER (LEGACY) ==========

  async getAllTicketing(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get('/api/lines/ticketing', { params });
    return response.data;
  }

  async syncFromTicketing(): Promise<SyncResult> {
    const response = await api.post('/api/lines/sync-ticketing');
    return response.data;
  }

  async syncLineUidsFromTicketing(
    dateValidFrom: string,
  ): Promise<LineUidsSyncResult> {
    const response = await api.post(
      `/api/lines/sync-line-uids/${dateValidFrom}`,
    );
    return response.data;
  }

  // ========== GRADSKI SERVER (LEGACY) ==========

  async getAllCity(
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<any>> {
    const params: any = { page, limit };
    if (dateValidFrom) {
      params.dateValidFrom = dateValidFrom;
    }
    const response = await api.get('/api/lines/city', { params });
    return response.data;
  }

  async syncFromCity(): Promise<SyncResult> {
    const response = await api.post('/api/lines/sync-city');
    return response.data;
  }
}

export const linesService = new LinesService();
