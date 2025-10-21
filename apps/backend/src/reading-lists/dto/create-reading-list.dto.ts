import { IsString } from 'class-validator';

export class CreateReadingListDto {
  @IsString()
  pod_kampanja_id: string;

  @IsString()
  ulica: string;

  @IsString()
  status: string;
}
