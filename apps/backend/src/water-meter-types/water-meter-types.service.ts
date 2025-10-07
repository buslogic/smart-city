import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterTypeDto } from './dto/create-water-meter-type.dto';
import { UpdateWaterMeterTypeDto } from './dto/update-water-meter-type.dto';

@Injectable()
export class WaterMeterTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.waterMeterType.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const waterMeterType = await this.prisma.waterMeterType.findUnique({
      where: { id },
    });

    if (!waterMeterType) {
      throw new NotFoundException(`Tip vodomera sa ID ${id} nije pronađen`);
    }

    return waterMeterType;
  }

  async create(createWaterMeterTypeDto: CreateWaterMeterTypeDto) {
    try {
      return await this.prisma.waterMeterType.create({
        data: createWaterMeterTypeDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Tip vodomera već postoji');
      }
      throw error;
    }
  }

  async update(id: number, updateWaterMeterTypeDto: UpdateWaterMeterTypeDto) {
    await this.findOne(id);

    try {
      return await this.prisma.waterMeterType.update({
        where: { id },
        data: updateWaterMeterTypeDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Tip vodomera već postoji');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.waterMeterType.delete({
      where: { id },
    });
  }
}
