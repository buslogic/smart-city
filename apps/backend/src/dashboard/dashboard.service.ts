import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(userId: number) {
    const dashboardConfig = await this.prisma.userDashboardConfig.findUnique({
      where: { userId },
      include: {
        widgets: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!dashboardConfig) {
      return this.createDefaultDashboard(userId);
    }

    return dashboardConfig;
  }

  private async createDefaultDashboard(userId: number) {
    return this.prisma.userDashboardConfig.create({
      data: {
        userId,
        config: {
          layout: 'grid',
          columns: 3,
          gap: 16,
        },
        widgets: {
          create: [],
        },
      },
      include: {
        widgets: true,
      },
    });
  }
}
