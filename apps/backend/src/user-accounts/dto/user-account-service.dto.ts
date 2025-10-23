import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetServicesByUserAccountIdDto {
  @ApiProperty({ description: 'User account ID' })
  @Type(() => Number)
  @IsInt()
  user_account_id: number;
}

export class AssignPricelistDto {
  @ApiProperty({ description: 'User account ID' })
  @Type(() => Number)
  @IsInt()
  user_account_id: number;

  @ApiProperty({ description: 'Pricelist ID' })
  @Type(() => Number)
  @IsInt()
  pricelist_id: number;
}

export class EditUserAccountServiceDto {
  @ApiProperty({ description: 'Service ID' })
  @Type(() => Number)
  @IsInt()
  id: number;

  @ApiProperty({ description: 'Pricelist ID' })
  @Type(() => Number)
  @IsInt()
  pricelist_id: number;

  @ApiProperty({ description: 'Active status (0 or 1)' })
  @Type(() => Number)
  @IsInt()
  active: number;
}

export class RemoveAccountServiceDto {
  @ApiProperty({ description: 'Account service ID' })
  @Type(() => Number)
  @IsInt()
  id: number;
}
