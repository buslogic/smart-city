import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateComplaintPriorityDto {
  @ApiProperty({ description: 'Naziv prioriteta', example: 'Visok' })
  @IsString()
  @IsNotEmpty()
  prioritet: string;
}
