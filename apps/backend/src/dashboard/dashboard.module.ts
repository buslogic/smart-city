import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardConfigService } from './dashboard-config.service';
import { DashboardWidgetsService } from './dashboard-widgets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    PrismaModule,
    VehiclesModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardConfigService,
    DashboardWidgetsService,
  ],
  exports: [DashboardService],
})
export class DashboardModule {}