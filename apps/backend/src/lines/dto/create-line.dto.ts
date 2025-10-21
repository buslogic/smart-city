import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsDecimal,
  MaxLength,
  IsNumberString,
} from 'class-validator';

export enum DirectionType {
  A = 'A',
  B = 'B',
}

export enum OnlineDiscountType {
  ZERO = '0',
  ONE = '1',
  TWO = '2',
}

export class CreateLineDto {
  // Required fields
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  lineNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  actualLineNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lineTitle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  dateValidFrom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  priceTableIdent: string;

  @IsInt()
  @IsNotEmpty()
  systemTypesId: number;

  @IsInt()
  @IsNotEmpty()
  categoriesLineId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  changedBy: string;

  // Optional fields with defaults
  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineTitleReturn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  rootLineNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  lineNumberForDisplay?: string;

  @IsBoolean()
  @IsOptional()
  circleRoute?: boolean;

  @IsEnum(DirectionType)
  @IsOptional()
  directionIdForDisplay?: DirectionType;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineTitleForDisplay?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineNumberForSite?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  furl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  toPlace?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  toPlaceTwo?: string;

  @IsInt()
  @IsOptional()
  numOfDirection?: number;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  officialDeparture?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  monthlyPriceTableIdent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  subversion?: string;

  @IsInt()
  @IsOptional()
  numberOfStations?: number;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  vatFromTaxTable?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  vatId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  vatValue?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  discountTariffTableIdent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  regionTableIdent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  zoneTableIdent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  distanceTableIdent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  citiesTableIdent?: string;

  @IsInt()
  @IsOptional()
  lineTypeId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lineType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2)
  changedSinceSync?: string;

  @IsString()
  @IsOptional()
  changeLog?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  changeIncremental?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  centralPointDbId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  centralPointName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8)
  status?: string;

  @IsInt()
  @IsOptional()
  busOperator?: number;

  @IsBoolean()
  @IsOptional()
  displayByDispachPlanning?: boolean;

  @IsString()
  @IsOptional()
  lineRoute?: string;

  @IsString()
  @IsOptional()
  lineRoute1?: string;

  @IsString()
  @IsOptional()
  bestfrom?: string;

  @IsString()
  @IsOptional()
  gLineRoute?: string;

  @IsString()
  @IsOptional()
  gLineRoute1?: string;

  @IsInt()
  @IsOptional()
  maxSpeed?: number;

  @IsInt()
  @IsOptional()
  timeAllowed?: number;

  @IsBoolean()
  @IsOptional()
  isolatedExportsAccountingSoftware?: boolean;

  @IsInt()
  @IsOptional()
  daysSellInAdvance?: number;

  @IsInt()
  @IsOptional()
  roundPrice?: number;

  @IsString()
  @IsOptional()
  bestFromRet?: string;

  @IsInt()
  @IsOptional()
  daysSellInAdvanceRet?: number;

  @IsString()
  @IsOptional()
  bestTo?: string;

  @IsString()
  @IsOptional()
  bestToRet?: string;

  @IsOptional()
  checkInAmount?: string;

  @IsOptional()
  pricePerKm?: string;

  @IsInt()
  @IsOptional()
  additionalLineTypeId?: number;

  @IsBoolean()
  @IsOptional()
  usedInDispech?: boolean;

  @IsBoolean()
  @IsOptional()
  showOnNet?: boolean;

  @IsBoolean()
  @IsOptional()
  showOnNetCity?: boolean;

  @IsInt()
  @IsOptional()
  netPricelistId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  payOnDelivery?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  mobilePhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  creditCard?: string;

  @IsBoolean()
  @IsOptional()
  usedInBooking?: boolean;

  @IsOptional()
  startTerminusKm?: string;

  @IsOptional()
  endTerminusKm?: string;

  @IsBoolean()
  @IsOptional()
  rvSaleFlag?: boolean;

  @IsInt()
  @IsOptional()
  rvLineSource?: number;

  @IsInt()
  @IsOptional()
  qrValidations?: number;

  @IsInt()
  @IsOptional()
  qrValidationsReturn?: number;

  @IsInt()
  @IsOptional()
  qrValidationsDir1?: number;

  @IsInt()
  @IsOptional()
  qrValidationsReturnDir1?: number;

  @IsInt()
  @IsOptional()
  transientPriceSetting?: number;

  @IsBoolean()
  @IsOptional()
  sellWithoutSeatNo?: boolean;

  @IsBoolean()
  @IsOptional()
  alwaysExportFlag?: boolean;

  @IsInt()
  @IsOptional()
  minModeSecurity?: number;

  @IsInt()
  @IsOptional()
  allowedMin?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  mainLineFromGroup?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  routeCode?: string;

  @IsInt()
  @IsOptional()
  gtfsRouteId?: number;

  @IsInt()
  @IsOptional()
  priceVariationId?: number;

  @IsInt()
  @IsOptional()
  wrongDirectionType?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  gtfsShapeId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1255)
  descriptionOfStreetsGtfs?: string;

  @IsBoolean()
  @IsOptional()
  usedInDateShedule?: boolean;

  @IsOptional()
  lineKmMeanValueWithBusTerminus?: string;

  @IsString()
  @IsOptional()
  timeFromByLine?: string;

  @IsString()
  @IsOptional()
  timeToByLine?: string;

  @IsEnum(OnlineDiscountType)
  @IsOptional()
  onlineDiscountType?: OnlineDiscountType;

  @IsBoolean()
  @IsOptional()
  showOnWeb?: boolean;

  @IsBoolean()
  @IsOptional()
  showOnAndroid?: boolean;

  @IsNumberString()
  @IsOptional()
  legacyTicketingId?: string;

  @IsNumberString()
  @IsOptional()
  legacyCityId?: string;
}
