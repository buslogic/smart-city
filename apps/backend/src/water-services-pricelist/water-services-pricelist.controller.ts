import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { WaterServicesPricelistService } from './water-services-pricelist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('water-services-pricelist')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterServicesPricelistController {
  constructor(
    private readonly service: WaterServicesPricelistService,
  ) {}

  // IDENTIČNO kao PHP WaterServicesPricelistController::getPricelistServicesForSL() (linija 47-51)
  @Post('search/for-sl')
  @RequirePermissions('water_services_pricelist:view')
  getPricelistServicesForSL(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getPricelistServicesForSL(body.query ?? '', body.pageNumber ?? 0);
  }
}
