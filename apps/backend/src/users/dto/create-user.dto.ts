import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiProperty({
    example: ['SUPER_ADMIN', 'CITY_MANAGER'],
    description: 'Array of role names to assign to user',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];

  @ApiProperty({
    example: 1,
    description: 'User group ID',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  userGroupId?: number;
}
