import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SyncStatusItem {
  @ApiProperty()
  @IsNumber()
  id: number;

  @ApiProperty()
  @IsBoolean()
  syncEnabled: boolean;
}

export class SyncStatusUpdateDto {
  @ApiProperty({
    type: [SyncStatusItem],
    description: 'Array of sync status updates'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncStatusItem)
  updates: SyncStatusItem[];
}