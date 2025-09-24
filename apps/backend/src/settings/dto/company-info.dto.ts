import { IsString, IsEmail, IsOptional, IsUrl, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyInfoDto {
  @ApiProperty({ description: 'Company name', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  companyName: string;

  @ApiProperty({ description: 'Tax ID (PIB)', pattern: '^\\d{9}$' })
  @IsString()
  @Matches(/^\d{9}$/, { message: 'Tax ID must be exactly 9 digits' })
  taxId: string;

  @ApiProperty({ description: 'Company address', maxLength: 300 })
  @IsString()
  @MaxLength(300)
  address: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @Matches(/^[+\d\s()-]+$/, { message: 'Invalid phone format' })
  phone: string;

  @ApiProperty({ description: 'Company email', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Bank account number' })
  @IsString()
  @Matches(/^[\d-]+$/, { message: 'Invalid bank account format' })
  bankAccount: string;

  @ApiProperty({ description: 'Bank name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  bankName: string;

  @ApiPropertyOptional({ description: 'Company website', format: 'url' })
  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ description: 'Company logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;
}

export class UpdateCompanyInfoDto extends CreateCompanyInfoDto {}