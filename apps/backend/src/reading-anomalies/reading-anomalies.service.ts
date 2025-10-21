import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateReadingAnomalyDto } from './dto/create-reading-anomaly.dto';
import { UpdateReadingAnomalyDto } from './dto/update-reading-anomaly.dto';

@Injectable()
export class ReadingAnomaliesService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async findAll() {
    const query =
      'SELECT * FROM vodovod_reading_anomalies ORDER BY id DESC';
    const anomalies = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);
    return anomalies;
  }

  async findOne(id: number) {
    const query = 'SELECT * FROM vodovod_reading_anomalies WHERE id = ?';
    const anomalies = await this.prismaLegacy.$queryRawUnsafe<any[]>(query, id);
    return anomalies.length > 0 ? anomalies[0] : null;
  }

  async create(createDto: CreateReadingAnomalyDto) {
    try {
      const query =
        'INSERT INTO vodovod_reading_anomalies (`status`, `description`) VALUES (?, ?)';
      await this.prismaLegacy.$executeRawUnsafe(
        query,
        createDto.status,
        createDto.description,
      );

      const idResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id',
      );
      const insertedId = idResult[0].id;

      const row = await this.findOne(insertedId);

      return {
        success: true,
        data: row,
      };
    } catch (error) {
      console.error('error when adding the row:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updateDto: UpdateReadingAnomalyDto) {
    try {
      const query =
        'UPDATE vodovod_reading_anomalies SET `status` = ?, `description` = ? WHERE id = ?';
      await this.prismaLegacy.$executeRawUnsafe(
        query,
        updateDto.status,
        updateDto.description,
        id,
      );

      const row = await this.findOne(id);

      return {
        success: true,
        data: row,
      };
    } catch (error) {
      console.error('error when updating the row:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    try {
      const query = 'DELETE FROM vodovod_reading_anomalies WHERE id = ?';
      await this.prismaLegacy.$executeRawUnsafe(query, id);
      return true;
    } catch (error) {
      console.error('error when deleting the row:', error);
      return false;
    }
  }
}
