import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLegacyDatabaseDto } from './dto/create-legacy-database.dto';
import {
  UpdateLegacyDatabaseDto,
  TestConnectionDto,
} from './dto/update-legacy-database.dto';
import * as crypto from 'crypto';
import { createConnection, Connection } from 'mysql2/promise';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
  connectionInfo?: {
    host: string;
    port: number;
    database: string;
    username: string;
    type: string;
  };
}

@Injectable()
export class LegacyDatabasesService {
  private readonly encryptionKey = this.generateEncryptionKey();
  private readonly algorithm = 'aes-256-cbc';

  private generateEncryptionKey(): Buffer {
    const key =
      process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
    // Ensure key is exactly 32 bytes for AES-256
    return crypto.scryptSync(key, 'salt', 32);
  }

  constructor(private prisma: PrismaService) {}

  private encryptPassword(password: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  public decryptPassword(encryptedPassword: string): string {
    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 2) {
        // If not in expected format, assume it's already plain text (backward compatibility)
        return encryptedPassword;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // If decryption fails, assume it's already plain text (backward compatibility)
      return encryptedPassword;
    }
  }

  async create(createLegacyDatabaseDto: CreateLegacyDatabaseDto) {
    const { password, ...rest } = createLegacyDatabaseDto;

    // Encrypt password (reversible encryption for database connections)
    const encryptedPassword = this.encryptPassword(password);

    return this.prisma.legacyDatabase.create({
      data: {
        ...rest,
        password: encryptedPassword,
      },
    });
  }

  async findAll() {
    const databases = await this.prisma.legacyDatabase.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Remove password from response
    return databases.map(({ password, ...db }) => db);
  }

  async findOne(id: number) {
    const database = await this.prisma.legacyDatabase.findUnique({
      where: { id },
    });

    if (!database) {
      throw new NotFoundException(`Legacy database sa ID ${id} nije pronađena`);
    }

    // Remove password from response
    const { password, ...result } = database;
    return result;
  }

  async update(id: number, updateLegacyDatabaseDto: UpdateLegacyDatabaseDto) {
    const existingDatabase = await this.findOne(id);

    const updateData = { ...updateLegacyDatabaseDto };

    // Encrypt password if provided
    if (updateLegacyDatabaseDto.password) {
      updateData.password = this.encryptPassword(
        updateLegacyDatabaseDto.password,
      );
    }

    const updated = await this.prisma.legacyDatabase.update({
      where: { id },
      data: updateData,
    });

    // Remove password from response
    const { password, ...result } = updated;
    return result;
  }

  async remove(id: number) {
    await this.findOne(id); // Check if exists

    await this.prisma.legacyDatabase.delete({
      where: { id },
    });

    return { message: `Legacy database sa ID ${id} je uspešno obrisana` };
  }

  async testConnection(id: number): Promise<ConnectionTestResult> {
    const database = await this.prisma.legacyDatabase.findUnique({
      where: { id },
    });

    if (!database) {
      throw new NotFoundException(`Legacy database sa ID ${id} nije pronađena`);
    }

    // Decrypt password for connection test
    const decryptedPassword = this.decryptPassword(database.password);
    const connectionData: TestConnectionDto = {
      host: database.host,
      port: database.port,
      database: database.database,
      username: database.username,
      password: decryptedPassword,
      type: database.type,
    };

    console.log(`🔍 Testing connection for database ID ${id}:`);
    console.log(`   Host: ${database.host}:${database.port}`);
    console.log(`   Database: ${database.database}`);
    console.log(`   Username: ${database.username}`);
    console.log(`   Type: ${database.type}`);
    console.log(`   Password length: ${decryptedPassword.length}`);
    console.log(
      `   Password starts with: ${decryptedPassword.substring(0, 3)}***`,
    );

    const result = await this.testDatabaseConnection(connectionData);

    // Add connection info to result
    result.connectionInfo = {
      host: database.host,
      port: database.port,
      database: database.database,
      username: database.username,
      type: database.type,
    };

    // Update database record with test results
    await this.prisma.legacyDatabase.update({
      where: { id },
      data: {
        testConnection: result.success,
        lastConnectionTest: new Date(),
        connectionError: result.success ? null : result.error,
      },
    });

    return result;
  }

  async testDatabaseConnection(
    testData: TestConnectionDto,
  ): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    console.log(
      `🚀 Starting ${testData.type.toUpperCase()} connection test...`,
    );

    try {
      switch (testData.type) {
        case 'mysql':
          return await this.testMySQLConnection(testData, startTime);
        case 'postgresql':
          return await this.testPostgreSQLConnection(testData, startTime);
        case 'mongodb':
          return await this.testMongoDBConnection(testData, startTime);
        default:
          throw new BadRequestException(
            `Tip baze "${testData.type}" nije podržan za testiranje`,
          );
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(
        `❌ Connection test failed after ${responseTime}ms:`,
        error.message,
      );
      return {
        success: false,
        message: 'Testiranje konekcije neuspešno',
        error: error.message,
        responseTime,
      };
    }
  }

  private async testMySQLConnection(
    testData: TestConnectionDto,
    startTime: number,
  ): Promise<ConnectionTestResult> {
    let connection: Connection | undefined;

    console.log(
      `   📡 Attempting MySQL connection to ${testData.host}:${testData.port}/${testData.database}`,
    );
    console.log(`   👤 Using username: ${testData.username}`);

    try {
      connection = await createConnection({
        host: testData.host,
        port: testData.port,
        user: testData.username,
        password: testData.password,
        database: testData.database,
        connectTimeout: 10000,
      });

      console.log(`   ✅ MySQL connection established, testing query...`);

      // Test query
      await connection.execute('SELECT 1');

      const responseTime = Date.now() - startTime;

      await connection.end();

      console.log(`   🎉 MySQL test successful in ${responseTime}ms`);

      return {
        success: true,
        message: 'MySQL konekcija uspešna',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(
        `   ❌ MySQL test failed in ${responseTime}ms:`,
        error.message,
      );

      if (connection) {
        await connection.end().catch(() => {});
      }

      return {
        success: false,
        message: 'MySQL konekcija neuspešna',
        error: this.formatConnectionError(error.message),
        responseTime,
      };
    }
  }

  private async testPostgreSQLConnection(
    testData: TestConnectionDto,
    startTime: number,
  ): Promise<ConnectionTestResult> {
    const client = new Client({
      host: testData.host,
      port: testData.port,
      user: testData.username,
      password: testData.password,
      database: testData.database,
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();

      // Test query
      await client.query('SELECT 1');

      const responseTime = Date.now() - startTime;

      await client.end();

      return {
        success: true,
        message: 'PostgreSQL konekcija uspešna',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await client.end().catch(() => {});

      return {
        success: false,
        message: 'PostgreSQL konekcija neuspešna',
        error: this.formatConnectionError(error.message),
        responseTime,
      };
    }
  }

  private async testMongoDBConnection(
    testData: TestConnectionDto,
    startTime: number,
  ): Promise<ConnectionTestResult> {
    const uri = `mongodb://${testData.username}:${testData.password}@${testData.host}:${testData.port}/${testData.database}`;
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    try {
      await client.connect();

      // Test connection
      await client.db().admin().ping();

      const responseTime = Date.now() - startTime;

      await client.close();

      return {
        success: true,
        message: 'MongoDB konekcija uspešna',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await client.close().catch(() => {});

      return {
        success: false,
        message: 'MongoDB konekcija neuspešna',
        error: this.formatConnectionError(error.message),
        responseTime,
      };
    }
  }

  private formatConnectionError(error: string): string {
    // Format common database connection errors for better UX
    if (error.includes('ECONNREFUSED')) {
      return 'Konekcija odbijena - proveriti host i port';
    }
    if (error.includes('ETIMEDOUT')) {
      return 'Timeout - server ne odgovara';
    }
    if (error.includes('Access denied')) {
      return 'Pristup odbačen - proveriti korisničko ime i lozinku';
    }
    if (error.includes('Unknown database')) {
      return 'Nepoznata baza podataka';
    }
    if (error.includes('authentication failed')) {
      return 'Autentifikacija neuspešna';
    }

    return error.length > 200 ? error.substring(0, 200) + '...' : error;
  }
}
