import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class QueryLinkedTurnusDto {
  @ApiProperty({
    description: 'Filter po broju linije (bilo koje od dve linije)',
    required: false,
    example: '18',
  })
  @IsOptional()
  @IsString()
  lineNumber?: string;

  @ApiProperty({
    description: 'Filter po statusu',
    enum: ['ACTIVE', 'INACTIVE'],
    required: false,
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
