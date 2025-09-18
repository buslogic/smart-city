/**
 * Vehicle Mapper Helper - Backend verzija
 *
 * Centralizovana logika za rad sa vehicle identifikatorima na backend-u.
 * VAŽNO: Uvek koristiti vehicle ID (iz bus_vehicles.id) kao primarni identifikator!
 *
 * @author Smart City Team
 * @date 2025-09-01
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusVehicle } from '@prisma/client';

interface VehicleCache {
  id: number;
  garageNumber: string;
  legacyId?: number | null;
  registrationNumber?: string | null;
  lastUpdated: Date;
}

@Injectable()
export class VehicleMapperService {
  // Cache sa TTL od 5 minuta
  private cache = new Map<string, VehicleCache>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minuta
  private allVehiclesCache: VehicleCache[] | null = null;
  private allVehiclesCacheTime: Date | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Dohvata vehicle ID na osnovu bilo kog identifikatora
   * Ovo je GLAVNA funkcija koju treba koristiti!
   */
  async resolveVehicleId(identifier: string | number): Promise<number> {
    // Ako je već broj, pretpostavi da je ID
    if (typeof identifier === 'number') {
      const vehicle = await this.getVehicleById(identifier);
      if (vehicle) {
        return identifier;
      }
      throw new Error(`Vozilo sa ID ${identifier} ne postoji`);
    }

    // Ako je string, pretpostavi da je garažni broj
    const vehicle = await this.getVehicleByGarageNumber(identifier);
    if (!vehicle) {
      throw new Error(`Vozilo sa garažnim brojem ${identifier} ne postoji`);
    }
    return vehicle.id;
  }

  /**
   * Dohvata vozilo po ID-u
   */
  async getVehicleById(id: number): Promise<VehicleCache | null> {
    const cacheKey = `id_${id}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const vehicle = await this.prisma.busVehicle.findUnique({
        where: { id },
      });

      if (vehicle) {
        const cacheData: VehicleCache = {
          id: vehicle.id,
          garageNumber: vehicle.garageNumber,
          legacyId: vehicle.legacyId,
          registrationNumber: vehicle.registrationNumber,
          lastUpdated: new Date(),
        };
        this.setCache(cacheKey, cacheData);
        this.setCache(`garage_${vehicle.garageNumber}`, cacheData);
        return cacheData;
      }
    } catch (error) {
      console.error(`Greška pri dohvatanju vozila sa ID ${id}:`, error);
    }

    return null;
  }

  /**
   * Dohvata vozilo po garažnom broju
   */
  async getVehicleByGarageNumber(
    garageNumber: string,
  ): Promise<VehicleCache | null> {
    const cacheKey = `garage_${garageNumber}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const vehicle = await this.prisma.busVehicle.findUnique({
        where: { garageNumber },
      });

      if (vehicle) {
        const cacheData: VehicleCache = {
          id: vehicle.id,
          garageNumber: vehicle.garageNumber,
          legacyId: vehicle.legacyId,
          registrationNumber: vehicle.registrationNumber,
          lastUpdated: new Date(),
        };
        this.setCache(cacheKey, cacheData);
        this.setCache(`id_${vehicle.id}`, cacheData);
        return cacheData;
      }
    } catch (error) {
      console.error(
        `Greška pri dohvatanju vozila sa garažnim brojem ${garageNumber}:`,
        error,
      );
    }

    return null;
  }

  /**
   * Konvertuje ID u garažni broj (za prikaz ili legacy integraciju)
   */
  async idToGarageNumber(id: number): Promise<string> {
    const vehicle = await this.getVehicleById(id);
    if (!vehicle) {
      throw new Error(`Vozilo sa ID ${id} ne postoji`);
    }
    return vehicle.garageNumber;
  }

  /**
   * Konvertuje garažni broj u ID (za interne operacije)
   */
  async garageNumberToId(garageNumber: string): Promise<number> {
    const vehicle = await this.getVehicleByGarageNumber(garageNumber);
    if (!vehicle) {
      throw new Error(`Vozilo sa garažnim brojem ${garageNumber} ne postoji`);
    }
    return vehicle.id;
  }

  /**
   * Dohvata legacy ID za vozilo
   */
  async getLegacyId(vehicleId: number): Promise<number | null> {
    const vehicle = await this.getVehicleById(vehicleId);
    return vehicle?.legacyId || null;
  }

  /**
   * Bulk mapiranje ID-eva u garažne brojeve
   */
  async mapIdsToGarageNumbers(ids: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>();

    const vehicles = await this.prisma.busVehicle.findMany({
      where: { id: { in: ids } },
      select: { id: true, garageNumber: true },
    });

    for (const vehicle of vehicles) {
      result.set(vehicle.id, vehicle.garageNumber);
    }

    return result;
  }

  /**
   * Bulk mapiranje garažnih brojeva u ID-eve
   */
  async mapGarageNumbersToIds(
    garageNumbers: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    const vehicles = await this.prisma.busVehicle.findMany({
      where: { garageNumber: { in: garageNumbers } },
      select: { id: true, garageNumber: true },
    });

    for (const vehicle of vehicles) {
      result.set(vehicle.garageNumber, vehicle.id);
    }

    return result;
  }

  /**
   * Dohvata sva vozila (sa cache-om)
   */
  async getAllVehicles(): Promise<VehicleCache[]> {
    // Proveri cache
    if (this.allVehiclesCache && this.allVehiclesCacheTime) {
      const age = Date.now() - this.allVehiclesCacheTime.getTime();
      if (age < this.cacheTimeout) {
        return this.allVehiclesCache;
      }
    }

    // Dohvati iz baze
    try {
      const vehicles = await this.prisma.busVehicle.findMany({
        select: {
          id: true,
          garageNumber: true,
          legacyId: true,
          registrationNumber: true,
        },
      });

      const cacheData: VehicleCache[] = vehicles.map((v) => ({
        id: v.id,
        garageNumber: v.garageNumber,
        legacyId: v.legacyId,
        registrationNumber: v.registrationNumber,
        lastUpdated: new Date(),
      }));

      this.allVehiclesCache = cacheData;
      this.allVehiclesCacheTime = new Date();

      return cacheData;
    } catch (error) {
      console.error('Greška pri dohvatanju svih vozila:', error);
      return [];
    }
  }

  /**
   * Validira garažni broj format
   */
  isValidGarageNumber(garageNumber: string): boolean {
    // Format: P + 5 cifara (npr. P93597)
    return /^P\d{5}$/.test(garageNumber);
  }

  /**
   * Formatira vozilo za prikaz
   */
  formatVehicleDisplay(vehicle: Partial<BusVehicle>): string {
    return `${vehicle.garageNumber} (ID: ${vehicle.id})`;
  }

  /**
   * Helper za dohvatanje iz cache-a
   */
  private getFromCache(key: string): VehicleCache | null {
    const cached = this.cache.get(key);
    if (cached) {
      const age = Date.now() - cached.lastUpdated.getTime();
      if (age < this.cacheTimeout) {
        return cached;
      }
      // Cache je istekao
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Helper za postavljanje cache-a
   */
  private setCache(key: string, value: VehicleCache): void {
    this.cache.set(key, value);
  }

  /**
   * Čisti cache (pozovi nakon CRUD operacija)
   */
  clearCache(): void {
    this.cache.clear();
    this.allVehiclesCache = null;
    this.allVehiclesCacheTime = null;
    console.log('[VehicleMapper] Cache očišćen');
  }

  /**
   * Proveri da li vozilo postoji
   */
  async vehicleExists(identifier: string | number): Promise<boolean> {
    try {
      await this.resolveVehicleId(identifier);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Dohvata vozilo za GPS operacije (vraća i ID i garage number)
   */
  async getVehicleForGPS(
    identifier: string | number,
  ): Promise<{ id: number; garageNumber: string }> {
    const vehicleId = await this.resolveVehicleId(identifier);
    const vehicle = await this.getVehicleById(vehicleId);

    if (!vehicle) {
      throw new Error(`Vozilo ${identifier} ne postoji`);
    }

    return {
      id: vehicle.id,
      garageNumber: vehicle.garageNumber,
    };
  }

  /**
   * Debug funkcija - prikaži stanje cache-a
   */
  debugCache(): void {
    console.log('[VehicleMapper] Cache status:');
    console.log(`- Pojedinačni cache: ${this.cache.size} vozila`);
    console.log(
      `- Sva vozila cache: ${this.allVehiclesCache?.length || 0} vozila`,
    );
    console.log(
      `- Cache starost: ${
        this.allVehiclesCacheTime
          ? Math.round(
              (Date.now() - this.allVehiclesCacheTime.getTime()) / 1000,
            ) + 's'
          : 'N/A'
      }`,
    );
  }
}

export default VehicleMapperService;
