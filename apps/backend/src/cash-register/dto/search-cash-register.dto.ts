import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchDto {
  @IsOptional()
  @IsString()
  query?: string = '';

  @IsOptional()
  @IsNumber()
  pageNumber?: number = 0;
}
