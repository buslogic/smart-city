import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';

@Injectable()
export class WaterMeterService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Raw SQL query sa svim JOIN-ovima
    // Napomena: vodovod_measuring_points i ordering_addresses trenutno ne postoje u ovoj bazi
    const waterMeters = await this.prisma.$queryRaw<any[]>`
      SELECT
        t1.id,
        t1.idmm,
        CONCAT(t2.id, ' | ', t2.type) as type_id,
        CONCAT(t3.id, ' | ', t3.availability) as availability_id,
        CONCAT(t4.id, ' | ', t4.manufacturer) as manufacturer_id,
        t1.calibrated_from,
        t1.calibrated_to,
        t1.serial_number,
        t1.counter,
        t1.idv,
        t1.module,
        t1.disconnection_date
      FROM vodovod_water_meter AS t1
      LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = t1.type_id
      LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = t1.availability_id
      LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = t1.manufacturer_id
      WHERE t1.aktivan = 1
      ORDER BY t1.id DESC
    `;

    // Formatiranje measuring_point polja
    // TODO: Dodati JOIN sa vodovod_measuring_points kada bude migrirana
    return waterMeters.map((wm) => ({
      ...wm,
      measuring_point: wm.idmm ? `${wm.idmm}` : null,
    }));
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
