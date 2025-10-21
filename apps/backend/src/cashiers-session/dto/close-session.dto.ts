import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CloseSessionDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsString()
  datum_otvaranja: string;

  @IsOptional()
  @IsString()
  napomena?: string;
}
