export class TimetableScheduleDto {
  id: number;
  datum: string; // Date as string (YYYY-MM-DD)
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

export class TimetableResponseDto {
  schedules: TimetableScheduleDto[];
  lineInfo: {
    lineNumber: string;
    lineNumberForDisplay: string;
    lineTitle: string;
  };
}

export class StationTimesDto {
  id: number;
  datum: string;
  idlinije: string;
  smer: number;
  dan: string;
  vreme: string;
  stanice: string; // CSV vremena
  stationNames?: string; // CSV naziva stanica (separator: |||)
  opis: string;
  gtfsTripId: string;
  legacyTicketingId: number | null;
  legacyCityId: number | null;
}
