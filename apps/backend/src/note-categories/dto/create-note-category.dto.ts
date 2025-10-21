import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteCategoryDto {
  @ApiProperty({ description: 'Naziv kategorije', example: 'Tehnički problemi' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
