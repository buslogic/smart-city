import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterMeterTypeDto {
  @ApiProperty({
    description: 'Naziv tipa vodomera',
    example: 'Tip 1',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Tip je obavezan' })
  @IsString({ message: 'Tip mora biti string' })
  @MaxLength(255, { message: 'Tip može imati maksimalno 255 karaktera' })
  type: string;
}
