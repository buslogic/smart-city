import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncStatusItemDto {
  @ApiProperty({
    description: 'ID of the user group',
    example: 1,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Whether sync is enabled for this group',
    example: true,
  })
  @IsBoolean()
  syncEnabled: boolean;
}

export class UpdateSyncStatusDto {
  @ApiProperty({
    description: 'Array of sync status updates',
    type: [SyncStatusItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncStatusItemDto)
  updates: SyncStatusItemDto[];
}