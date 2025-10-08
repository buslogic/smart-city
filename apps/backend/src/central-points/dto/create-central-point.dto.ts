import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsInt,
  MaxLength,
} from 'class-validator';

export class CreateCentralPointDto {
  // Osnovne informacije
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  zip: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  // Kontakt informacije
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone1: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone2: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  // Boss informacije
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  boss: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bossPhone: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  bossEmail: string;

  // Geografija
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  mainStationUid: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  longitude: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  latitude: string;

  // Ostala polja
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  comment: string;

  @IsNumber()
  @IsNotEmpty()
  owes: number;

  @IsNumber()
  @IsNotEmpty()
  expects: number;

  @IsNumber()
  @IsNotEmpty()
  saldo: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  incomeSettlementTimeframeCp?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  changedBy: string;

  @IsBoolean()
  @IsOptional()
  enablejavaapplet?: boolean;

  @IsInt()
  @IsOptional()
  enableticketreturn?: number;

  @IsBoolean()
  @IsOptional()
  enableticketdelete?: boolean;

  @IsBoolean()
  @IsOptional()
  enableotherticketscheck?: boolean;

  @IsInt()
  @IsOptional()
  enablejournalcheck?: number;

  @IsBoolean()
  @IsOptional()
  internalFuel?: boolean | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(7)
  color: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(7)
  lineColor: string;

  @IsOptional()
  image?: Buffer | null;

  @IsOptional()
  imageAndroid?: Buffer | null;

  @IsOptional()
  customerInfoCloseDeparture?: Buffer | null;

  @IsOptional()
  customerInfoOpenDeparture?: Buffer | null;

  @IsOptional()
  validatorCloseDeparture?: Buffer | null;

  @IsOptional()
  validatorOpenDeparture?: Buffer | null;

  @IsInt()
  @IsOptional()
  sendAndroidPinRequestToAdmin?: number;

  @IsInt()
  @IsOptional()
  androidAdmin?: number;

  @IsInt()
  @IsOptional()
  countryId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  countryName?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(15)
  vatId?: string | null;

  @IsInt()
  @IsOptional()
  otherCpView?: number;

  @IsInt()
  @IsOptional()
  dispatchOrderByCp?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  placeOfTheInvoice?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  currentAccount?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  currentAccountForPlastic?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  depotCode?: string | null;

  @IsBoolean()
  @IsOptional()
  creatingZipByGtfsStandard?: boolean;

  @IsInt()
  @IsOptional()
  defaultDeviceListSubgroupId?: number | null;

  // Legacy sync tracking
  @IsInt()
  @IsOptional()
  legacyTicketingId?: number | null;

  @IsInt()
  @IsOptional()
  legacyCityId?: number | null;
}
