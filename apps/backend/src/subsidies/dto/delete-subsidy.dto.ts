import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class DeleteSubsidyDto {
  @IsInt()
  @Type(() => Number)
  id: number;
}
