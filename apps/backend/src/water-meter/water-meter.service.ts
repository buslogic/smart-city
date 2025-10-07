import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';

@Injectable()
export class WaterMeterService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.waterMeter.findMany({
      include: {
        type: true,
        availability: true,
        manufacturer: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const waterMeter = await this.prisma.waterMeter.findUnique({
      where: { id },
      include: {
        type: true,
        availability: true,
        manufacturer: true,
        replacements: true,
      },
    });

    if (!waterMeter) {
      throw new NotFoundException(`Vodomer sa ID ${id} nije pronađen`);
    }

    return waterMeter;
  }

  async create(createDto: CreateWaterMeterDto) {
    const created = await this.prisma.waterMeter.create({
      data: createDto,
    });
    return this.findOne(created.id);
  }

  async update(id: number, updateDto: UpdateWaterMeterDto) {
    await this.findOne(id);

    await this.prisma.waterMeter.update({
      where: { id },
      data: updateDto,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.waterMeter.delete({
      where: { id },
    });
    return { success: true };
  }
}
