import { IsInt, IsString, IsOptional } from 'class-validator';

export class CreateSubCampaignDto {
  @IsString()
  kampanja: string; // Format: "ID | YYYY-MM"

  @IsOptional()
  @IsInt()
  kampanja_id?: number;

  @IsString()
  dan: string; // Ponedeljak, Utorak, ...

  @IsInt()
  vreme_od: number; // 0-24

  @IsInt()
  vreme_do: number; // 0-24

  @IsString()
  region_id: string; // Format: "ID | Name"

  @IsString()
  citac_id: string; // Format: "ID | FirstName LastName"

  @IsString()
  status_id: string; // Format: "ID | Name"
}
