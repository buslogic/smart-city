import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaterSupplyNoteDto {
  @ApiProperty({ description: 'ID kategorije beleške ili "ID | Naziv" format' })
  @IsNotEmpty()
  categoryId: string | number;

  @ApiProperty({ description: 'Naslov beleške', example: 'Važna napomena' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Sadržaj beleške', example: 'Detaljno objašnjenje...' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'ID autora (opciono, postavlja se automatski)' })
  @IsInt()
  @IsOptional()
  authorId?: number;

  @ApiProperty({ description: 'Da li je zakačena beleška', example: 0, default: 0 })
  @IsInt()
  isPinned: number;

  @ApiProperty({ description: 'Da li je privatna beleška', example: 0, default: 0 })
  @IsInt()
  isPrivate: number;
}
