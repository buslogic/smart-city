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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule, 
    AuthModule,
    UsersModule, 
    RolesModule, 
    PermissionsModule,
    LegacyDatabasesModule,
    LegacyTableMappingsModule,
    VehiclesModule,
    VehicleSyncModule,
    DispatcherModule,
    GpsIngestModule,
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
