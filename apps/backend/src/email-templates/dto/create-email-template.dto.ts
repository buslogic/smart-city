import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Unique template slug' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ description: 'Email subject' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Plain text body' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @ApiProperty({ description: 'HTML body', required: false })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiProperty({ description: 'Template category', default: 'general' })
  @IsOptional()
  @IsString()
  category?: string = 'general';

  @ApiProperty({ description: 'Template variables', required: false })
  @IsOptional()
  @IsArray()
  variables?: string[];

  @ApiProperty({ description: 'Is template active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}