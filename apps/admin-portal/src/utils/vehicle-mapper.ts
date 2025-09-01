/**
 * Vehicle Mapper Helper
 * 
 * Centralizovana logika za rad sa vehicle identifikatorima.
 * VAŽNO: Uvek koristiti vehicle ID (iz bus_vehicles.id) kao primarni identifikator!
 * Garažni broj se koristi SAMO za prikaz i legacy integraciju.
 * 
 * @author Smart City Team
 * @date 2025-09-01
 */

import { vehiclesService } from '../services/vehicles.service';

interface VehicleCache {
  id: number;
  garageNumber: string;
  legacyId?: number;
  registrationNumber?: string;
  lastUpdated: Date;
}

/**
 * Helper klasa za mapiranje između različitih vehicle identifikatora
 */
export class VehicleMapper {
  // Cache sa TTL od 5 minuta
  private static cache = new Map<string, VehicleCache>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minuta
  private static allVehiclesCache: VehicleCache[] | null = null;
  private static allVehiclesCacheTime: Date | null = null;

  /**
   * Dohvata vehicle ID na osnovu bilo kog identifikatora
   * Ovo je GLAVNA funkcija koju treba koristiti!
   */
  static async resolveVehicleId(identifier: string | number): Promise<number> {
    // Ako je već broj, pretpostavi da je ID
    if (typeof identifier === 'number') {
      // Proveri da li zaista postoji
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
  static async getVehicleById(id: number): Promise<VehicleCache | null> {
    const cacheKey = `id_${id}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const vehicle = await vehiclesService.getById(id);
      if (vehicle) {
        const cacheData: VehicleCache = {
          id: vehicle.id,
          garageNumber: vehicle.garageNumber,
          legacyId: vehicle.legacyId,
          registrationNumber: vehicle.registrationNumber,
          lastUpdated: new Date()
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
  static async getVehicleByGarageNumber(garageNumber: string): Promise<VehicleCache | null> {
    const cacheKey = `garage_${garageNumber}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Dohvati sve vozila ako nisu u cache-u
    const vehicles = await this.getAllVehicles();
    const vehicle = vehicles.find(v => v.garageNumber === garageNumber);
    
    if (vehicle) {
      this.setCache(cacheKey, vehicle);
      this.setCache(`id_${vehicle.id}`, vehicle);
      return vehicle;
    }
    
    return null;
  }

  /**
   * Konvertuje ID u garažni broj (za prikaz)
   */
  static async idToGarageNumber(id: number): Promise<string> {
    const vehicle = await this.getVehicleById(id);
    if (!vehicle) {
      throw new Error(`Vozilo sa ID ${id} ne postoji`);
    }
    return vehicle.garageNumber;
  }

  /**
   * Konvertuje garažni broj u ID (za API pozive)
   */
  static async garageNumberToId(garageNumber: string): Promise<number> {
    const vehicle = await this.getVehicleByGarageNumber(garageNumber);
    if (!vehicle) {
      throw new Error(`Vozilo sa garažnim brojem ${garageNumber} ne postoji`);
    }
    return vehicle.id;
  }

  /**
   * Bulk mapiranje ID-eva u garažne brojeve
   */
  static async mapIdsToGarageNumbers(ids: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const vehicles = await this.getAllVehicles();
    
    for (const id of ids) {
      const vehicle = vehicles.find(v => v.id === id);
      if (vehicle) {
        result.set(id, vehicle.garageNumber);
      }
    }
    
    return result;
  }

  /**
   * Bulk mapiranje garažnih brojeva u ID-eve
   */
  static async mapGarageNumbersToIds(garageNumbers: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const vehicles = await this.getAllVehicles();
    
    for (const garageNo of garageNumbers) {
      const vehicle = vehicles.find(v => v.garageNumber === garageNo);
      if (vehicle) {
        result.set(garageNo, vehicle.id);
      }
    }
    
    return result;
  }

  /**
   * Dohvata sva vozila (sa cache-om)
   */
  private static async getAllVehicles(): Promise<VehicleCache[]> {
    // Proveri cache
    if (this.allVehiclesCache && this.allVehiclesCacheTime) {
      const age = Date.now() - this.allVehiclesCacheTime.getTime();
      if (age < this.cacheTimeout) {
        return this.allVehiclesCache;
      }
    }

    // Dohvati sa servera
    try {
      const response = await vehiclesService.getAll(1, 2000); // Učitaj sva vozila
      const vehicles: VehicleCache[] = response.data.map(v => ({
        id: v.id,
        garageNumber: v.garageNumber,
        legacyId: v.legacyId,
        registrationNumber: v.registrationNumber,
        lastUpdated: new Date()
      }));
      
      this.allVehiclesCache = vehicles;
      this.allVehiclesCacheTime = new Date();
      
      return vehicles;
    } catch (error) {
      console.error('Greška pri dohvatanju svih vozila:', error);
      return [];
    }
  }

  /**
   * Validira garažni broj format
   */
  static isValidGarageNumber(garageNumber: string): boolean {
    // Format: P + 5 cifara (npr. P93597)
    return /^P\d{5}$/.test(garageNumber);
  }

  /**
   * Formatira vozilo za prikaz
   */
  static formatVehicleDisplay(vehicle: VehicleCache | { id: number; garageNumber: string }): string {
    return `${vehicle.garageNumber} (ID: ${vehicle.id})`;
  }

  /**
   * Dohvata label za vozilo (za select opcije)
   */
  static async getVehicleLabel(vehicleId: number): Promise<string> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) {
      return `Vozilo ${vehicleId}`;
    }
    
    if (vehicle.registrationNumber) {
      return `${vehicle.garageNumber} - ${vehicle.registrationNumber}`;
    }
    return vehicle.garageNumber;
  }

  /**
   * Helper za dohvatanje iz cache-a
   */
  private static getFromCache(key: string): VehicleCache | null {
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
  private static setCache(key: string, value: VehicleCache): void {
    this.cache.set(key, value);
  }

  /**
   * Čisti cache (pozovi nakon CRUD operacija)
   */
  static clearCache(): void {
    this.cache.clear();
    this.allVehiclesCache = null;
    this.allVehiclesCacheTime = null;
    // console.log('[VehicleMapper] Cache očišćen');
  }

  /**
   * Proveri da li vozilo postoji
   */
  static async vehicleExists(identifier: string | number): Promise<boolean> {
    try {
      await this.resolveVehicleId(identifier);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Debug funkcija - prikaži stanje cache-a
   */
  static debugCache(): void {
    // console.log('[VehicleMapper] Cache status:');
    // console.log(`- Pojedinačni cache: ${this.cache.size} vozila`);
    // console.log(`- Sva vozila cache: ${this.allVehiclesCache?.length || 0} vozila`);
    // console.log(`- Cache starost: ${this.allVehiclesCacheTime ? 
    //   Math.round((Date.now() - this.allVehiclesCacheTime.getTime()) / 1000) + 's' : 
    //   'N/A'}`);
  }
}

// Export za lakše korišćenje
export default VehicleMapper;

// Export pojedinačnih funkcija za one koji preferiraju funkcionalni pristup
export const resolveVehicleId = VehicleMapper.resolveVehicleId.bind(VehicleMapper);
export const idToGarageNumber = VehicleMapper.idToGarageNumber.bind(VehicleMapper);
export const garageNumberToId = VehicleMapper.garageNumberToId.bind(VehicleMapper);
export const clearVehicleCache = VehicleMapper.clearCache.bind(VehicleMapper);