import { IsArray, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserAccountDto {
  @ApiProperty({ required: false, description: 'CRM Contact ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  crm_contact_id?: number;

  @ApiProperty({ required: false, description: 'CRM Account ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  crm_account_id?: number;

  @ApiProperty({ required: false, description: 'Delivery Address ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  delivery_address_id?: number;

  @ApiProperty({ type: [Number], description: 'Array of pricelist IDs to assign' })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  pricelist_ids: number[];
}
