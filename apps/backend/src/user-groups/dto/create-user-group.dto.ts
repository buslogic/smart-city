import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateUserGroupDto {
  @ApiProperty({
    description: 'Name of the user group',
    example: 'Drivers',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  groupName: string;

  @ApiProperty({
    description: 'Whether this group is for drivers',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  driver?: boolean = false;

  @ApiProperty({
    description: 'User class level (1-20)',
    example: 5,
    minimum: 1,
    maximum: 20,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  userClass?: number = 1;

  @ApiProperty({
    description: 'Description of the user group',
    example: 'Group for all company drivers',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the group is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiProperty({
    description: 'Whether the group is enabled for legacy sync',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  syncEnabled?: boolean = false;
}