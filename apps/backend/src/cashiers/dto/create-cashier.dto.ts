import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateCashierDto {
  @IsNotEmpty()
  @IsNumber()
  crm_contact_id: number;

  @IsNotEmpty()
  @IsNumber()
  kasa_id: number;
}
