import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class RemoveSubsidyDto {
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  id: number;
}
