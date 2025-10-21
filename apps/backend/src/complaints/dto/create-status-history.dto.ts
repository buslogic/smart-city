import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStatusHistoryDto {
  @ApiProperty({ description: 'ID reklamacije' })
  @IsNumber()
  @IsNotEmpty()
  reklamacija_id: number;

  @ApiProperty({ description: 'ID statusa (može biti "1 | Naziv" format)' })
  @IsString()
  @IsNotEmpty()
  status_id: string;

  @ApiProperty({ description: 'Napomena', required: false })
  @IsString()
  @IsOptional()
  napomena?: string;

  @ApiProperty({ description: 'Datum promene', required: false })
  @IsString()
  @IsOptional()
  datum_promene?: string;
}
