import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchManufacturerDto {
  @ApiProperty({ required: false, description: 'Tekst za pretragu' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ required: false, description: 'Broj stranice', default: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  pageNumber?: number;
}
