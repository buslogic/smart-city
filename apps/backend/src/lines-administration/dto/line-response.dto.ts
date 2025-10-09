export enum VariationStatus {
  AKTUELNA = 'AKTUELNA',
  BUDUCA = 'BUDUĆA',
  ISTEKLA = 'ISTEKLA',
  BEZ_VARIJACIJE = 'BEZ_VARIJACIJE',
}

export class LineResponseDto {
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
  variationStatus: VariationStatus;
}

export class PriceTableGroupDto {
  id: number;
  name: string;
  status: string;
  dateValidFrom: Date;
}

export class PaginatedLinesResponseDto {
  data: LineResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
