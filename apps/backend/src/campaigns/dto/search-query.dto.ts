import { IsOptional, IsString, IsInt } from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  pageNumber?: number;
}
