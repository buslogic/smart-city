import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateWaterServiceDto {
  @ApiProperty({ description: 'Naziv usluge', example: 'Priključak na vodovod' })
  @IsString()
  service: string;

  @ApiProperty({
    description: 'Napomena',
    example: 'Dodatne informacije',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Šifra usluge', example: 1, required: false })
  @IsOptional()
  @IsInt()
  code?: number;
}
