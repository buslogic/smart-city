import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'john.doe@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: ['SUPER_ADMIN', 'CITY_MANAGER'],
    description: 'Array of role names to assign to user',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}
