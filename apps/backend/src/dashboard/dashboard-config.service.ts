import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDashboardConfigDto } from './dto/update-dashboard-config.dto';

@Injectable()
export class DashboardConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserConfig(userId: number) {
    let config = await this.prisma.userDashboardConfig.findUnique({
      where: { userId },
      include: {
        widgets: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!config) {
      config = await this.createDefaultConfig(userId);
    }

    return config;
  }

  async updateUserConfig(userId: number, updateDto: UpdateDashboardConfigDto) {
    const config = await this.prisma.userDashboardConfig.upsert({
      where: { userId },
      update: {
        config: updateDto.config,
        updatedAt: new Date(),
      },
      create: {
        userId,
        config: updateDto.config,
      },
      include: {
        widgets: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return config;
  }

  async toggleWidget(userId: number, widgetId: string, enabled: boolean) {
    const config = await this.getUserConfig(userId);

    const existingWidget = await this.prisma.userDashboardWidget.findFirst({
      where: {
        configId: config.id,
        widgetId,
      },
    });

    if (existingWidget) {
      return this.prisma.userDashboardWidget.update({
        where: { id: existingWidget.id },
        data: { enabled },
      });
    } else if (enabled) {
      const maxOrder = await this.prisma.userDashboardWidget.aggregate({
        where: { configId: config.id },
        _max: { order: true },
      });

      return this.prisma.userDashboardWidget.create({
        data: {
          configId: config.id,
          widgetId,
          enabled: true,
          order: (maxOrder._max.order || 0) + 1,
          config: {},
        },
      });
    }
  }

  async updateWidgetOrder(userId: number, widgetOrder: string[]) {
    const config = await this.getUserConfig(userId);

    const updatePromises = widgetOrder.map((widgetId, index) =>
      this.prisma.userDashboardWidget.updateMany({
        where: {
          configId: config.id,
          widgetId,
        },
        data: {
          order: index,
        },
      }),
    );

    await Promise.all(updatePromises);

    return this.getUserConfig(userId);
  }

  async updateWidgetSize(
    userId: number,
    widgetId: string,
    width: number,
    height: number,
  ) {
    const config = await this.getUserConfig(userId);

    const widget = await this.prisma.userDashboardWidget.findFirst({
      where: {
        configId: config.id,
        widgetId,
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    return this.prisma.userDashboardWidget.update({
      where: { id: widget.id },
      data: {
        config: {
          ...(widget.config as any),
          width,
          height,
        },
      },
    });
  }

  private async createDefaultConfig(userId: number) {
    return this.prisma.userDashboardConfig.create({
      data: {
        userId,
        config: {
          layout: 'grid',
          columns: 3,
          gap: 16,
          theme: 'light',
        },
        widgets: {
          create: [],
        },
      },
      include: {
        widgets: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }
}