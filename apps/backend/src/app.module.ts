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
import { GpsLagMonitoringModule } from './gps-lag-monitoring/gps-lag-monitoring.module';
import { CentralPointsModule } from './central-points/central-points.module';
import { PriceListGroupsModule } from './price-list-groups/price-list-groups.module';
import { StopsSyncModule } from './stops-sync/stops-sync.module';
import { LinesModule } from './lines/lines.module';
import { PriceVariationsModule } from './price-variations/price-variations.module';
import { TimetableDatesModule } from './timetable-dates/timetable-dates.module';
import { LinesAdministrationModule } from './lines-administration/lines-administration.module';
import { TimetableSchedulesModule } from './timetable-schedules/timetable-schedules.module';
import { TurnusiSyncModule } from './turnusi-sync/turnusi-sync.module';

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
    GpsLagMonitoringModule,
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
    CentralPointsModule,
    PriceListGroupsModule,
    StopsSyncModule,
    LinesModule,
    LinesAdministrationModule,
    PriceVariationsModule,
    TimetableDatesModule,
    TimetableSchedulesModule,
    TurnusiSyncModule,
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
