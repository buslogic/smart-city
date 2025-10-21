import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsBoolean, IsString } from 'class-validator';

export class CreateWaterServicePriceDto {
  @ApiProperty({ description: 'ID usluge', example: 1 })
  @IsInt()
  service_id: number;

  @ApiProperty({ description: 'ID kategorije potrošača', example: 1 })
  @IsInt()
  category_id: number;

  @ApiProperty({ description: 'Fiksna naplata', example: 0, required: false })
  @IsOptional()
  @IsInt()
  fixed_charge?: number;

  @ApiProperty({ description: 'Cena', example: 100 })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Potrošnja od', example: 0, required: false })
  @IsOptional()
  @IsNumber()
  usage_fee_from?: number;

  @ApiProperty({ description: 'Potrošnja do', example: 0, required: false })
  @IsOptional()
  @IsNumber()
  usage_fee_to?: number;

  @ApiProperty({ description: 'Stopa PDV-a', example: 20, required: false })
  @IsOptional()
  @IsNumber()
  VAT_rate?: number;

  @ApiProperty({ description: 'Dodeli automatski', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  assign_by_default?: boolean;

  @ApiProperty({ description: 'Naziv dokumenta', required: false })
  @IsOptional()
  @IsString()
  document_name?: string;
}
