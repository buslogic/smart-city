import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuthModule } from './auth/auth.module';
import { LegacyDatabasesModule } from './legacy-databases/legacy-databases.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { LegacyTableMappingsModule } from './legacy-table-mappings/legacy-table-mappings.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { VehicleSyncModule } from './vehicle-sync/vehicle-sync.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { GpsIngestModule } from './gps-ingest/gps-ingest.module';
import { GpsAnalyticsModule } from './gps-analytics/gps-analytics.module';
import { GpsSyncModule } from './gps-sync/gps-sync.module';
import { DrivingBehaviorModule } from './driving-behavior/driving-behavior.module';
import { SpacesModule } from './spaces/spaces.module';
import { UploadsModule } from './users/uploads/uploads.module';
import { GpsProcessorModule } from './gps-processor/gps-processor.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardModule } from './dashboard/dashboard.module';
import { TimescaledbModule } from './timescaledb/timescaledb.module';
import { DrivingRecreationModule } from './safety/driving-recreation/driving-recreation.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { MailModule } from './mail/mail.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { MigrationModule } from './migration/migration.module';
import { SettingsModule } from './settings/settings.module';
import { UserGroupsModule } from './user-groups/user-groups.module';
import { WaterMeterTypesModule } from './water-meter-types/water-meter-types.module';
import { WaterMeterAvailabilityModule } from './water-meter-availability/water-meter-availability.module';
import { WaterMeterManufacturersModule } from './water-meter-manufacturers/water-meter-manufacturers.module';
import { WaterMeterRemarksModule } from './water-meter-remarks/water-meter-remarks.module';
import { WaterMeterModule } from './water-meter/water-meter.module';
import { ReplacementWaterMetersModule } from './replacement-water-meters/replacement-water-meters.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    UserGroupsModule,
    RolesModule,
    PermissionsModule,
    LegacyDatabasesModule,
    LegacyTableMappingsModule,
    VehiclesModule,
    VehicleSyncModule,
    DispatcherModule,
    GpsIngestModule,
    GpsAnalyticsModule,
    GpsSyncModule,
    GpsProcessorModule,
    DrivingBehaviorModule,
    SpacesModule,
    UploadsModule,
    DashboardModule,
    TimescaledbModule,
    DrivingRecreationModule,
    ApiKeysModule,
    MailModule,
    EmailTemplatesModule,
    MigrationModule,
    SettingsModule,
    UserGroupsModule,
    WaterMeterTypesModule,
    WaterMeterAvailabilityModule,
    WaterMeterManufacturersModule,
    WaterMeterRemarksModule,
    WaterMeterModule,
    ReplacementWaterMetersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
