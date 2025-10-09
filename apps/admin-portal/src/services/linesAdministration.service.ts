import { api } from './api';

export const VariationStatus = {
  AKTUELNA: 'AKTUELNA',
  BUDUCA: 'BUDUĆA',
  ISTEKLA: 'ISTEKLA',
  BEZ_VARIJACIJE: 'BEZ_VARIJACIJE',
} as const;

export type VariationStatusType = typeof VariationStatus[keyof typeof VariationStatus];

export interface LineWithVariation {
  id: number;
  lineNumber: string;
  lineNumberForDisplay: string;
  lineTitle: string;
  direction: string;
  lineType: string;
  lineStatus: string;
  variationId: number | null;
  variationName: string | null;
  datetimeFrom: Date | null;
  datetimeTo: Date | null;
  variationStatus: VariationStatusType;
}

export interface PriceTableGroup {
  id: number;
  name: string;
  status: string;
  dateValidFrom: Date;
}

export interface PaginatedLinesResponse {
  data: LineWithVariation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetLinesParams {
  groupId?: number;
  page?: number;
  limit?: number;
  search?: string;
  showExpired?: boolean;
  showOnlyActive?: boolean;
  showInactive?: boolean;
}

class LinesAdministrationService {
  async getPriceTableGroups(): Promise<PriceTableGroup[]> {
    const response = await api.get('/api/lines-administration/groups');
    return response.data;
  }

  async getLines(params: GetLinesParams): Promise<PaginatedLinesResponse> {
    const response = await api.get('/api/lines-administration/lines', { params });
    return response.data;
  }
}

export const linesAdministrationService = new LinesAdministrationService();
