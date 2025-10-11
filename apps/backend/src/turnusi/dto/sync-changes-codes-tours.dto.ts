import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt } from 'class-validator';

export class SyncChangesCodesToursDto {
  @ApiProperty({
    description: 'ID grupe turnusa',
    example: 3,
  })
  @IsNotEmpty()
  @IsInt()
  groupId: number;
}
