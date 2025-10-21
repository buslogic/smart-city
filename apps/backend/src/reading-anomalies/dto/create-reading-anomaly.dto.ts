import { IsString } from 'class-validator';

export class CreateReadingAnomalyDto {
  @IsString()
  status: string;

  @IsString()
  description: string;
}
