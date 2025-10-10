import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SyncTimetableSchedulesDto {
  @ApiProperty({
    description: 'Datum grupe za RedVoznje (YYYY-MM-DD format)',
    required: true,
    example: '2023-08-31',
  })
  @IsNotEmpty({ message: 'Datum grupe je obavezan' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Datum mora biti u YYYY-MM-DD formatu',
  })
  dateValidFrom: string;
}
