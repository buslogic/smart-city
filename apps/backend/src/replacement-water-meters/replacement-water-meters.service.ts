import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReplacementWaterMeterDto } from './dto/create-replacement-water-meter.dto';
import { UpdateReplacementWaterMeterDto } from './dto/update-replacement-water-meter.dto';

@Injectable()
export class ReplacementWaterMetersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.replacedWaterMeter.findMany({
      include: {
        replacedMeter: true,
        typeRef: true,
        availabilityRef: true,
        manufacturerRef: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const replacement = await this.prisma.replacedWaterMeter.findUnique({
      where: { id },
      include: {
        replacedMeter: true,
        typeRef: true,
        availabilityRef: true,
        manufacturerRef: true,
      },
    });

    if (!replacement) {
      throw new NotFoundException(`Zamenjen vodomer sa ID ${id} nije pronađen`);
    }

    return replacement;
  }

  async create(createDto: CreateReplacementWaterMeterDto) {
    const created = await this.prisma.replacedWaterMeter.create({
      data: createDto,
    });
    return this.findOne(created.id);
  }

  async update(id: number, updateDto: UpdateReplacementWaterMeterDto) {
    await this.findOne(id);

    await this.prisma.replacedWaterMeter.update({
      where: { id },
      data: updateDto,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.replacedWaterMeter.delete({
      where: { id },
    });
    return { success: true };
  }
}
