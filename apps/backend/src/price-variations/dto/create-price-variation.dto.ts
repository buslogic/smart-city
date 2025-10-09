import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  IsNumberString,
  IsDateString,
} from 'class-validator';

export class CreatePriceVariationDto {
  // Required fields
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  variationName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  variationDescription: string;

  @IsInt()
  @IsNotEmpty()
  lineTypeId: number;

  // Optional fields
  @IsString()
  @IsOptional()
  @MaxLength(250)
  gtfsRouteSettingsId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  direction?: string;

  @IsBoolean()
  @IsOptional()
  mainBasicRoute?: boolean;

  @IsDateString()
  @IsOptional()
  datetimeFrom?: string;

  @IsDateString()
  @IsOptional()
  datetimeTo?: string;

  @IsNumberString()
  @IsOptional()
  legacyTicketingId?: string;

  @IsNumberString()
  @IsOptional()
  legacyCityId?: string;
}
