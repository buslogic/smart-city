import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUserAccountsDto {
  @ApiProperty({ required: false, description: 'Search query string' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ required: false, description: 'Page number for pagination', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageNumber?: number = 0;
}

export class SearchUserAccountByIdDto {
  @ApiProperty({ description: 'User account ID' })
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class SearchUserAccountsByTypeDto {
  @ApiProperty({ enum: ['idmm', 'consumer'], description: 'Type of search' })
  @IsString()
  type: 'idmm' | 'consumer';

  @ApiProperty({ required: false, description: 'Search value' })
  @IsOptional()
  @IsString()
  value?: string;
}
