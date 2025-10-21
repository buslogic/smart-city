import { IsString, IsOptional } from 'class-validator';

export class UpdateReadingAnomalyDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
