import { ApiProperty } from '@nestjs/swagger';

export class MainScheduleLineDto {
  @ApiProperty({ description: 'Price table ident (sistemski broj linije)' })
  priceTableIdent: string;

  @ApiProperty({ description: 'Broj linije' })
  lineNumber: string;

  @ApiProperty({ description: 'Broj linije za prikaz' })
  lineNumberForDisplay: string;

  @ApiProperty({ description: 'Naziv linije' })
  lineTitle: string;

  @ApiProperty({ description: 'Smer linije' })
  direction: string;

  @ApiProperty({ description: 'Tip linije' })
  lineType: string;

  @ApiProperty({ description: 'Ukupan broj vremena_polaska rekorda' })
  totalSchedules: number;

  @ApiProperty({
    description: 'Da li linija ima podatke sinhronizovane sa Ticketing servera',
  })
  hasTicketingData: boolean;

  @ApiProperty({
    description: 'Da li linija ima podatke sinhronizovane sa City servera',
  })
  hasCityData: boolean;

  @ApiProperty({
    description: 'Broj vremena_polaska rekorda sa legacy_ticketing_id',
  })
  legacyTicketingCount: number;

  @ApiProperty({
    description: 'Broj vremena_polaska rekorda sa legacy_city_id',
  })
  legacyCityCount: number;
}

export class MainSchedulesResponseDto {
  @ApiProperty({ type: [MainScheduleLineDto], description: 'Lista linija' })
  data: MainScheduleLineDto[];

  @ApiProperty({ description: 'Ukupan broj linija' })
  total: number;
}
