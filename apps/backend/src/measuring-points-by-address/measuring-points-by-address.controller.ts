import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MeasuringPointsByAddressService } from './measuring-points-by-address.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('measuring-points-by-address')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MeasuringPointsByAddressController {
  constructor(
    private readonly service: MeasuringPointsByAddressService,
  ) {}

  // IDENTIČNO kao PHP MeasuringPointsByAddressController::getAddressByIDMM() (linija 13-17)
  @Post('get-address-by-idmm')
  @RequirePermissions('measuring_points_by_address:view')
  getAddressByIDMM(@Body() body: { idmm: number }) {
    return this.service.getAddressByIDMM(body.idmm);
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressController::getAddresses() (linija 19-23)
  @Post('get-addresses')
  @RequirePermissions('measuring_points_by_address:view')
  getAddresses(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getAddresses(body.query, body.pageNumber ?? 0);
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressController::getAddressHistory() (linija 25-29)
  @Post('get-address-history')
  @RequirePermissions('measuring_points_by_address:view')
  getAddressHistory() {
    return this.service.getAddressHistory();
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressController::saveNewAddress() (linija 31-43)
  @Post('save-new-address')
  @RequirePermissions('measuring_points_by_address:create')
  async saveNewAddress(@Body() body: {
    idmm: string;
    staraAdresa: string;
    brojAdrese: string;
    ulaz: string;
    novaAdresa: string;
    noviBroj: string;
    noviUlaz: string;
  }) {
    try {
      const data = await this.service.saveNewAddress(body);
      return { success: true, data };
    } catch (error) {
      console.error('saveNewAddress error:', error);
      return {
        success: false,
        error: 'Došlo je do greške.',
      };
    }
  }
}
