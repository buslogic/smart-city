import { PartialType } from '@nestjs/mapped-types';
import { CreatePriceListGroupDto } from './create-price-list-group.dto';

export class UpdatePriceListGroupDto extends PartialType(
  CreatePriceListGroupDto,
) {}
