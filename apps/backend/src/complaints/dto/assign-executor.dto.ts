import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignExecutorDto {
  @ApiProperty({ description: 'ID reklamacije' })
  @IsInt()
  @IsNotEmpty()
  complaintId: number;

  @ApiProperty({ description: 'ID izvršioca' })
  @IsNotEmpty()
  executorId: string | number;

  @ApiProperty({ description: 'Status ID (ID | naziv format)' })
  @IsNotEmpty()
  statusId: string | number;
}
