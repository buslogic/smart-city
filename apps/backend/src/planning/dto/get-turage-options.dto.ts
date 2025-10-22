import { IsString, IsInt, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetTurageOptionsDto {
  @ApiProperty({
    description: 'Broj linije (line_number_for_display)',
    example: '18',
  })
  @IsString()
  lineNumber: string;

  @ApiProperty({
    description: 'Ime turnusa',
    example: '00018-1',
  })
  @IsString()
  turnusName: string;

  @ApiProperty({
    description: 'Broj smene (1, 2, 3)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  shiftNumber: number;

  @ApiProperty({
    description: 'Dan u nedelji (Subota ili Nedelja)',
    example: 'Subota',
    enum: ['Subota', 'Nedelja'],
  })
  @IsString()
  @IsIn(['Subota', 'Nedelja'])
  dayOfWeek: 'Subota' | 'Nedelja';
}
