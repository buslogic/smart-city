import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto, RevokeApiKeyDto } from './dto/update-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto, ApiKeyLogResponseDto } from './dto/api-key-response.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ApiKeyType, ApiKey, ApiKeyLog } from '@prisma/client';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generiše novi API ključ sa sigurnim formatom
   */
  private generateApiKey(type: ApiKeyType, environment: string = 'prod'): string {
    const typeMap = {
      [ApiKeyType.SWAGGER_ACCESS]: 'swagger',
      [ApiKeyType.API_ACCESS]: 'api',
      [ApiKeyType.ADMIN_ACCESS]: 'admin',
      [ApiKeyType.INTEGRATION]: 'integration',
    };

    const typePrefix = typeMap[type] || 'api';
    const randomString = crypto.randomBytes(18).toString('base64url'); // 24 karaktera
    
    return `sk_${environment}_${typePrefix}_${randomString}`;
  }

  /**
   * Generiše display key (poslednje 4 karaktera sa prefiksom)
   */
  private generateDisplayKey(fullKey: string): string {
    const lastPart = fullKey.slice(-4);
    return `...${lastPart}`;
  }

  /**
   * Hash-uje API ključ pomoću bcrypt
   */
  private async hashApiKey(key: string): Promise<string> {
    const saltRounds = 12; // Visok salt za dodatnu sigurnost
    return await bcrypt.hash(key, saltRounds);
  }

  /**
   * Verifikuje API ključ protiv hash-a
   */
  async verifyApiKey(key: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(key, hash);
    } catch (error) {
      this.logger.error('Greška pri verifikaciji API ključa:', error);
      return false;
    }
  }

  /**
   * Kreira novi API ključ
   */
  async create(dto: CreateApiKeyDto, createdBy: number): Promise<CreateApiKeyResponseDto> {
    // Generiši API ključ
    const apiKey = this.generateApiKey(dto.type);
    const keyHash = await this.hashApiKey(apiKey);
    const displayKey = this.generateDisplayKey(apiKey);

    // Konvertuj expiresAt string u Date ako je prosleđen
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    try {
      // Kreiraj ključ u bazi
      const createdKey = await this.prisma.apiKey.create({
        data: {
          key: apiKey, // Čuvamo temp za povratak - uklonićemo odmah
          keyHash,
          displayKey,
          name: dto.name,
          description: dto.description,
          type: dto.type,
          permissions: dto.permissions ? JSON.stringify(dto.permissions) : undefined,
          allowedIps: dto.allowedIps ? JSON.stringify(dto.allowedIps) : undefined,
          rateLimit: dto.rateLimit,
          expiresAt,
          createdBy,
        },
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Logiraj kreiranje
      await this.logActivity(createdKey.id, 'key_created', undefined, {
        endpoint: '/api/api-keys',
        method: 'POST',
        responseCode: 201,
      });

      // Ukloni raw key iz baze nakon što ga vratimo (čuvamo samo hash)
      await this.prisma.apiKey.update({
        where: { id: createdKey.id },
        data: { key: '' }, // Uklanjamo plain text key
      });

      this.logger.log(`API ključ kreiran: ${displayKey} (${dto.type}) za korisnika ${createdBy}`);

      // Vratimo response sa celim ključem SAMO JEDNOM
      return {
        ...this.mapToResponseDto(createdKey),
        key: apiKey, // Ovo je jedini put kada vraćamo ceo ključ!
      };

    } catch (error) {
      if (error.code === 'P2002') { // Unique constraint error
        throw new ConflictException('API ključ sa tim nazivom već postoji');
      }
      this.logger.error('Greška pri kreiranju API ključa:', error);
      throw error;
    }
  }

  /**
   * Lista svih API ključeva (bez raw key vrednosti)
   */
  async findAll(userId?: number): Promise<ApiKeyResponseDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: userId ? { createdBy: userId } : undefined,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        revoker: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(key => this.mapToResponseDto(key));
  }

  /**
   * Pronađi API ključ po ID
   */
  async findOne(id: number): Promise<ApiKeyResponseDto> {
    const key = await this.prisma.apiKey.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        revoker: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!key) {
      throw new NotFoundException(`API ključ sa ID ${id} nije pronađen`);
    }

    return this.mapToResponseDto(key);
  }

  /**
   * Ažuriraj API ključ
   */
  async update(id: number, dto: UpdateApiKeyDto, updatedBy: number): Promise<ApiKeyResponseDto> {
    const existingKey = await this.prisma.apiKey.findUnique({ where: { id } });
    
    if (!existingKey) {
      throw new NotFoundException(`API ključ sa ID ${id} nije pronađen`);
    }

    if (existingKey.revokedAt) {
      throw new BadRequestException('Ne može se ažurirati revokovan ključ');
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions ? JSON.stringify(dto.permissions) : undefined,
        allowedIps: dto.allowedIps ? JSON.stringify(dto.allowedIps) : undefined,
        rateLimit: dto.rateLimit,
        expiresAt,
        isActive: dto.isActive,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        revoker: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.logActivity(id, 'key_updated', undefined, {
      endpoint: `/api/api-keys/${id}`,
      method: 'PUT',
      responseCode: 200,
    });

    this.logger.log(`API ključ ažuriran: ${existingKey.displayKey} od strane korisnika ${updatedBy}`);

    return this.mapToResponseDto(updatedKey);
  }

  /**
   * Revokuj API ključ
   */
  async revoke(id: number, dto: RevokeApiKeyDto, revokedBy: number): Promise<ApiKeyResponseDto> {
    const existingKey = await this.prisma.apiKey.findUnique({ where: { id } });
    
    if (!existingKey) {
      throw new NotFoundException(`API ključ sa ID ${id} nije pronađen`);
    }

    if (existingKey.revokedAt) {
      throw new BadRequestException('Ključ je već revokovan');
    }

    const revokedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
        revokeReason: dto.reason,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        revoker: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.logActivity(id, 'key_revoked', undefined, {
      endpoint: `/api/api-keys/${id}/revoke`,
      method: 'POST',
      responseCode: 200,
      errorMessage: dto.reason,
    });

    this.logger.warn(`API ključ revokovan: ${existingKey.displayKey} od strane korisnika ${revokedBy}. Razlog: ${dto.reason}`);

    return this.mapToResponseDto(revokedKey);
  }

  /**
   * Validira API ključ za autentifikaciju
   */
  async validateApiKey(rawKey: string, ipAddress?: string, userAgent?: string, endpoint?: string, method?: string): Promise<ApiKey | null> {
    const startTime = Date.now();

    try {
      // Pronađi sve aktivne ključeve
      const activeKeys = await this.prisma.apiKey.findMany({
        where: {
          isActive: true,
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      // Proverava ključ protiv svaka hash-a
      for (const key of activeKeys) {
        if (await this.verifyApiKey(rawKey, key.keyHash)) {
          // Ključ je valjan - proveri IP restrikcije
          if (key.allowedIps && ipAddress) {
            const allowedIps = JSON.parse(key.allowedIps as string);
            if (!this.checkIpAllowed(ipAddress, allowedIps)) {
              await this.logActivity(key.id, 'access_denied', ipAddress, {
                userAgent,
                endpoint,
                method,
                responseCode: 403,
                responseTime: Date.now() - startTime,
                errorMessage: 'IP adresa nije dozvoljena',
              });
              return null;
            }
          }

          // Ažuriraj usage statistike
          await this.prisma.apiKey.update({
            where: { id: key.id },
            data: {
              lastUsedAt: new Date(),
              lastUsedIp: ipAddress,
              usageCount: { increment: 1 },
            },
          });

          // Logiraj uspešan pristup
          await this.logActivity(key.id, 'access_granted', ipAddress, {
            userAgent,
            endpoint,
            method,
            responseCode: 200,
            responseTime: Date.now() - startTime,
          });

          return key;
        }
      }

      // Ključ nije pronađen
      await this.logActivity(undefined, 'access_denied', ipAddress, {
        userAgent,
        endpoint,
        method,
        responseCode: 401,
        responseTime: Date.now() - startTime,
        errorMessage: 'Neispravan API ključ',
      });

      return null;

    } catch (error) {
      this.logger.error('Greška pri validaciji API ključa:', error);
      return null;
    }
  }

  /**
   * Dobij audit log za API ključ
   */
  async getAuditLog(id: number, limit: number = 100): Promise<ApiKeyLogResponseDto[]> {
    const logs = await this.prisma.apiKeyLog.findMany({
      where: { apiKeyId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map(log => ({
      id: log.id,
      apiKeyId: log.apiKeyId,
      action: log.action,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      endpoint: log.endpoint || undefined,
      method: log.method || undefined,
      responseCode: log.responseCode || undefined,
      responseTime: log.responseTime || undefined,
      errorMessage: log.errorMessage || undefined,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Logiraj aktivnost API ključa
   */
  private async logActivity(
    apiKeyId: number | undefined, 
    action: string, 
    ipAddress?: string, 
    details?: {
      userAgent?: string;
      endpoint?: string;
      method?: string;
      responseCode?: number;
      responseTime?: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      // Ako nema apiKeyId, preskoči logovanje
      if (!apiKeyId) {
        return;
      }
      
      await this.prisma.apiKeyLog.create({
        data: {
          apiKeyId,
          action,
          ipAddress,
          userAgent: details?.userAgent,
          endpoint: details?.endpoint,
          method: details?.method,
          responseCode: details?.responseCode,
          responseTime: details?.responseTime,
          errorMessage: details?.errorMessage,
        },
      });
    } catch (error) {
      this.logger.error('Greška pri logovanju aktivnosti API ključa:', error);
      // Ne bacaj grešku jer je logging sekundarno
    }
  }

  /**
   * Proveri da li je IP adresa dozvoljena
   */
  private checkIpAllowed(ipAddress: string, allowedIps: string[]): boolean {
    // Implementacija IP proveravanja - jednostavno proveri da li se nalazi u listi
    // TODO: Dodati podršku za CIDR notaciju (192.168.1.0/24)
    return allowedIps.includes(ipAddress);
  }

  /**
   * Map-uj entitet u response DTO
   */
  private mapToResponseDto(key: any): ApiKeyResponseDto {
    return {
      id: key.id,
      displayKey: key.displayKey,
      name: key.name,
      description: key.description,
      type: key.type,
      permissions: key.permissions ? JSON.parse(key.permissions) : null,
      allowedIps: key.allowedIps ? JSON.parse(key.allowedIps) : null,
      rateLimit: key.rateLimit,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      lastUsedIp: key.lastUsedIp,
      usageCount: key.usageCount,
      isActive: key.isActive,
      revokedAt: key.revokedAt,
      revokeReason: key.revokeReason,
      creator: key.creator,
      revoker: key.revoker,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }
}