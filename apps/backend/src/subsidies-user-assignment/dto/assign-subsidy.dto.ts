import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignSubsidyDto {
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  korisnik_id: number;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  subvencija_id: number;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  status: number;
}
