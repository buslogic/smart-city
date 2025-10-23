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
  centralPointId: string;
  centralPointName: string;
  variationId: number | null;
  variationName: string | null;
  datetimeFrom: Date | null;
  datetimeTo: Date | null;
  variationStatus: VariationStatusType;
  priceTableIdent?: string;
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

export interface TimetableSchedule {
  id: number;
  datum: string;
  idlinije: string;
  smer: number;
  pon: string;
  uto: string;
  sre: string;
  cet: string;
  pet: string;
  sub: string;
  ned: string;
  dk1: string;
  dk1naziv: string;
  dk2: string;
  dk2naziv: string;
  dk3: string;
  dk3naziv: string;
  dk4: string;
  dk4naziv: string;
  variation: number;
  datetimeFrom: Date;
  datetimeTo: Date;
  variationDescription: string;
  legacyTicketingId: number | null;
  legacyCityId: number | null;
}

export interface TimetableResponse {
  schedules: TimetableSchedule[];
  lineInfo: {
    lineNumber: string;
    lineNumberForDisplay: string;
    lineTitle: string;
  };
}

export interface StationTimes {
  id: number;
  datum: string;
  idlinije: string;
  smer: number;
  dan: string;
  vreme: string;
  stanice: string;
  stationNames?: string; // CSV naziva stanica (separator: |||)
  opis: string;
  gtfsTripId: string;
  legacyTicketingId: number | null;
  legacyCityId: number | null;
}

export interface StationOnLine {
  stationNumber: number;
  stationUid: number;
  stationName: string | null;
  gpsx: string | null;
  gpsy: string | null;
  disableShowOnPublic: boolean;
  transientStation: boolean;
  changedBy: number;
  changeDateTime: Date;
}

export interface StationsOnLineResponse {
  stations: StationOnLine[];
  lineInfo: {
    lineNumber: string;
    lineNumberForDisplay: string;
    lineTitle: string;
    dateValidFrom: string;
  };
  tableName: string;
  totalStations: number;
}

export interface TurnusRecord {
  id: number;
  turnusId: number;
  turnusName: string;
  lineNo: string;
  startTime: Date | string; // Can be string in HH:mm:ss format after backend CAST
  direction: number;
  duration: Date | string; // Can be string in HH:mm:ss format after backend CAST
  centralPoint: string;
  changeCode: number;
  jobId: number;
  newStartTime: Date | string; // Can be string in HH:mm:ss format after backend CAST
  newDuration: Date | string; // Can be string in HH:mm:ss format after backend CAST
  startStation: number;
  endStation: number;
  dayNumber: number;
  lineTypeId: number;
  rezijski: string;
  printId: string;
  betweenRez: number;
  busNumber: number;
  startStationId: number;
  endStationId: number;
  changeTime: Date;
  changeUser: string;
  active: number;
  firstDayDurationPart: Date | string; // Can be string in HH:mm:ss format after backend CAST
  secondDayDurationPart: Date | string; // Can be string in HH:mm:ss format after backend CAST
  customId: string;
  transportId: string;
  departureNumber: number;
  shiftNumber: number;
  turageNo: number;
  departureNoInTurage: number;
  // Line info from lines table JOIN
  lineNumberForDisplay?: string;
  lineTitle?: string;
  lineTitleForDisplay?: string;
}

export interface TurnusiResponse {
  data: TurnusRecord[];
  total: number;
  lineNumber: string;
}

export interface ShiftDetail {
  shiftNumber: number;
  firstDepartureTime: Date | string; // Can be string in HH:mm:ss format after backend CAST
  lastDepartureTime: Date | string;  // Can be string in HH:mm:ss format after backend CAST
  departureCount: number;
}

export interface GroupedTurnus {
  turnusId: number;
  turnusName: string;
  transportId: string;
  dayname: string;
  active: number;
  departureCount: number;
  firstDepartureTime: Date | string; // Can be string in HH:mm:ss format after backend CAST
  lastDepartureTime: Date | string;  // Can be string in HH:mm:ss format after backend CAST
  linesServed: string[];
  shiftsCount: number;
  driversNeeded: number;
  shiftNumbers: number[];
  shiftDetails: ShiftDetail[];
  turageNumbers: number[];
  departures: TurnusRecord[];
}

export interface GroupedTurnusiResponse {
  grouped: GroupedTurnus[];
  total: number;
  lineNumber: string;
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

  async getTimetables(priceTableIdent: string): Promise<TimetableResponse> {
    const response = await api.get(`/api/lines-administration/lines/${encodeURIComponent(priceTableIdent)}/timetables`);
    return response.data;
  }

  async getStationTimes(
    idlinije: string,
    smer: number,
    dan: string,
    vreme: string
  ): Promise<StationTimes> {
    const response = await api.get('/api/lines-administration/station-times', {
      params: { idlinije, smer, dan, vreme },
    });
    return response.data;
  }

  async getStationsOnLine(priceTableIdent: string): Promise<StationsOnLineResponse> {
    const response = await api.get(`/api/lines-administration/lines/${encodeURIComponent(priceTableIdent)}/stations`);
    return response.data;
  }

  async getTurnusiByLine(lineNumber: string): Promise<TurnusiResponse> {
    const response = await api.get(`/api/turnusi/local/by-line/${encodeURIComponent(lineNumber)}`);
    return response.data;
  }

  async getTurnusiGroupedByLine(lineNumber: string): Promise<GroupedTurnusiResponse> {
    const response = await api.get(`/api/turnusi/local/by-line/${encodeURIComponent(lineNumber)}/grouped`);
    return response.data;
  }
}

export const linesAdministrationService = new LinesAdministrationService();
