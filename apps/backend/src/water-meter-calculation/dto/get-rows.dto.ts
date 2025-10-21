import { IsInt, Min, Max } from 'class-validator';

export class GetRowsDto {
  @IsInt()
  @Min(1970)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
