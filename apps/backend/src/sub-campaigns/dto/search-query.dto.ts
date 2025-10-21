import { IsString, IsInt, IsOptional } from 'class-validator';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  pageNumber?: number;
}
