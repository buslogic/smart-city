import { IsNotEmpty, IsNumber } from 'class-validator';

export class OpenSessionDto {
  @IsNotEmpty()
  @IsNumber()
  pocetni_iznos: number;
}
