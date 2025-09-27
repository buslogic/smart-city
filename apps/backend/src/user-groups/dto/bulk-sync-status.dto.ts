import { IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SyncStatusItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  syncEnabled: boolean;
}

export class BulkSyncStatusDto {
  @ApiProperty({
    type: [SyncStatusItemDto],
    description: 'Array of sync status updates'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncStatusItemDto)
  items: SyncStatusItemDto[];
}