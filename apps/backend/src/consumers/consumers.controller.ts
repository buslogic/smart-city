import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ConsumersService } from './consumers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('consumers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConsumersController {
  constructor(private readonly service: ConsumersService) {}

  // IDENTIČNO kao PHP ConsumersController::getConsumersForSL() (linija 39-43)
  @Post('search/for-sl')
  @RequirePermissions('consumers:view')
  getConsumersForSL(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getConsumersForSL(body.query ?? '', body.pageNumber ?? 0);
  }
}
