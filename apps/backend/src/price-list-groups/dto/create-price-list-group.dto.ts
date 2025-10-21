import {
  IsString,
  IsNotEmpty,
  IsDateString,
  MaxLength,
  IsOptional,
  IsNumberString,
} from 'class-validator';

export class CreatePriceListGroupDto {
  @IsDateString()
  @IsNotEmpty()
  dateValidFrom: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  synchroStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  sendIncremental?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  changedBy: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsNumberString()
  @IsOptional()
  legacyCityId?: string;
}
