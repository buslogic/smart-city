import { IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncStatusItemDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  syncEnabled: boolean;
}

// This DTO represents the array directly
export class SyncStatusBodyDto extends Array<SyncStatusItemDto> {
  constructor(...items: SyncStatusItemDto[]) {
    super();
    Object.setPrototypeOf(this, SyncStatusBodyDto.prototype);
    this.push(...items);
  }
}