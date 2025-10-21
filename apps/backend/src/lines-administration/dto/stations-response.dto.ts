export class StationOnLineDto {
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

export class StationsOnLineResponseDto {
  stations: StationOnLineDto[];
  lineInfo: {
    lineNumber: string;
    lineNumberForDisplay: string;
    lineTitle: string;
    dateValidFrom: string;
  };
  tableName: string;
  totalStations: number;
}
