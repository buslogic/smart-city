import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
}

@Injectable()
export class DashboardWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly widgets: WidgetDefinition[] = [
    {
      id: 'vehicle-statistics',
      name: 'Statistike vozila',
      description: 'Pregled ukupnog broja vozila, aktivnih i neaktivnih',
      category: 'transport',
      requiredPermission: 'dashboard.widgets.vehicles:view',
      defaultSize: { width: 1, height: 1 },
      minSize: { width: 1, height: 1 },
      maxSize: { width: 2, height: 2 },
    },
    {
      id: 'gps-sync-status',
      name: 'Status GPS sinhronizacije',
      description: 'Trenutni status GPS sinhronizacije',
      category: 'transport',
      requiredPermission: 'dashboard.widgets.gps:view',
      defaultSize: { width: 2, height: 1 },
      minSize: { width: 1, height: 1 },
      maxSize: { width: 3, height: 2 },
    },
    {
      id: 'user-statistics',
      name: 'Statistike korisnika',
      description: 'Broj korisnika po rolama',
      category: 'administration',
      requiredPermission: 'dashboard.widgets.users:view',
      defaultSize: { width: 1, height: 1 },
      minSize: { width: 1, height: 1 },
      maxSize: { width: 2, height: 2 },
    },
    {
      id: 'system-health',
      name: 'Zdravlje sistema',
      description: 'Status servisa i performanse',
      category: 'system',
      requiredPermission: 'dashboard.widgets.system:view',
      defaultSize: { width: 2, height: 2 },
      minSize: { width: 2, height: 1 },
      maxSize: { width: 3, height: 3 },
    },
  ];

  async getAvailableWidgets(user: any) {
    const userPermissions = await this.getUserPermissions(user);

    return this.widgets.filter((widget) =>
      this.hasPermission(userPermissions, widget.requiredPermission),
    );
  }

  async getVehicleStatistics() {
    const [total, active, inactive] = await Promise.all([
      this.prisma.busVehicle.count(),
      this.prisma.busVehicle.count({
        where: { active: true },
      }),
      this.prisma.busVehicle.count({
        where: { active: false },
      }),
    ]);

    const recentlyUpdated = await this.prisma.busVehicle.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    const withGPS = await this.prisma.busVehicle.count({
      where: {
        imei: { not: null },
      },
    });

    return {
      total,
      active,
      inactive,
      recentlyUpdated,
      withGPS,
      withoutGPS: total - withGPS,
      activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
      inactivePercentage: total > 0 ? Math.round((inactive / total) * 100) : 0,
    };
  }

  async getGpsSyncStatus() {
    // Dohvati status buffer-a
    const [statusCounts, lastBatch, settings] = await Promise.all([
      // Status counts iz buffer-a
      this.prisma.$queryRaw<Array<{ process_status: string; count: bigint }>>`
        SELECT process_status, COUNT(*) as count 
        FROM gps_raw_buffer 
        GROUP BY process_status
      `,

      // Poslednji batch
      this.prisma.gpsBatchHistory.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          batchNumber: true,
          startedAt: true,
          completedAt: true,
          actualProcessed: true,
          batchSize: true,
          workerCount: true,
          totalDurationMs: true,
          avgRecordsPerSecond: true,
          status: true,
        },
      }),

      // GPS settings
      this.prisma.systemSettings.findMany({
        where: {
          key: {
            in: [
              'gps.processor.batch_size',
              'gps.processor.worker_count',
              'gps.processor.use_worker_pool',
            ],
          },
        },
      }),
    ]);

    // Organizuj status counts
    const bufferStatus = {
      total: 0,
      pending: 0,
      processing: 0,
      processed: 0,
      error: 0,
    };

    statusCounts.forEach((status) => {
      const count = Number(status.count);
      bufferStatus[status.process_status] = count;
      bufferStatus.total += count;
    });

    // Parse settings
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.type === 'number' ? parseInt(s.value) : s.value;
    });

    // Proveri da li je sistem aktivan (poslednji batch u poslednjih 2 minuta)
    const isActive =
      lastBatch &&
      lastBatch.startedAt &&
      new Date().getTime() - new Date(lastBatch.startedAt).getTime() < 120000;

    return {
      buffer: {
        totalRecords: bufferStatus.total,
        pendingRecords: bufferStatus.pending,
        processingRecords: bufferStatus.processing,
        processedRecords: bufferStatus.processed,
        errorRecords: bufferStatus.error,
      },
      lastBatch: lastBatch
        ? {
            number: lastBatch.batchNumber,
            startedAt: lastBatch.startedAt,
            completedAt: lastBatch.completedAt,
            processed: lastBatch.actualProcessed,
            duration: lastBatch.totalDurationMs,
            recordsPerSecond: lastBatch.avgRecordsPerSecond,
            status: lastBatch.status,
          }
        : null,
      config: {
        batchSize: settingsMap['gps.processor.batch_size'] || 10000,
        workerCount: settingsMap['gps.processor.worker_count'] || 4,
        useWorkerPool: settingsMap['gps.processor.use_worker_pool'] === 'true',
      },
      systemStatus: {
        isActive,
        lastSync: lastBatch?.completedAt || lastBatch?.startedAt || null,
      },
    };
  }

  private async getUserPermissions(user: any) {
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    userWithRoles?.roles.forEach((userRole) => {
      userRole.role.permissions.forEach((rolePermission) => {
        const perm = rolePermission.permission;
        // Dodajemo permisiju u formatu sa tačkom
        permissions.add(perm.name);
      });
    });

    return Array.from(permissions);
  }

  private hasPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    return (
      userPermissions.includes(requiredPermission) ||
      userPermissions.includes('*:*') ||
      userPermissions.includes('dashboard:*')
    );
  }
}
