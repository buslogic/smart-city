import { PartialType } from '@nestjs/mapped-types';
import { CreatePriceVariationDto } from './create-price-variation.dto';

export class UpdatePriceVariationDto extends PartialType(CreatePriceVariationDto) {}
