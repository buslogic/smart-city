import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterAvailabilityDto } from './dto/create-water-meter-availability.dto';
import { UpdateWaterMeterAvailabilityDto } from './dto/update-water-meter-availability.dto';

@Injectable()
export class WaterMeterAvailabilityService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.waterMeterAvailability.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const availability = await this.prisma.waterMeterAvailability.findUnique({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException(`Dostupnost sa ID ${id} nije pronađena`);
    }

    return availability;
  }

  async create(createDto: CreateWaterMeterAvailabilityDto) {
    const created = await this.prisma.waterMeterAvailability.create({
      data: createDto,
    });
    return this.findOne(created.id);
  }

  async update(id: number, updateDto: UpdateWaterMeterAvailabilityDto) {
    await this.findOne(id);

    await this.prisma.waterMeterAvailability.update({
      where: { id },
      data: updateDto,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.waterMeterAvailability.delete({
      where: { id },
    });
    return { success: true };
  }
}
