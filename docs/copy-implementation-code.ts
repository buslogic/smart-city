/**
 * COPY Implementation Code Snippets
 * Gotov kod za copy/paste implementaciju
 */

// ============================================
// 1. WORKER POOL SERVICE - COPY IMPLEMENTACIJA
// ============================================

import { from as copyFrom } from 'pg-copy-streams';

/**
 * Nova metoda za COPY import u legacy-sync-worker-pool.service.ts
 * Dodati posle insertBatchToTimescale metode
 */
private async insertWithCopy(
  batch: any[],
  pool: Pool,
  vehicleId: number,
  garageNo: string
): Promise<void> {
  const startTime = Date.now();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Kreiraj jedinstvenu temp tabelu
    const tempTableName = `gps_data_temp_${vehicleId}_${Date.now()}`;
    await client.query(`
      CREATE TEMP TABLE ${tempTableName} (
        LIKE gps_data INCLUDING DEFAULTS
      ) ON COMMIT DROP
    `);
    
    // 2. Pripremi COPY stream (bez location - trigger će je generisati)
    const stream = client.query(copyFrom(`
      COPY ${tempTableName} (
        time, vehicle_id, garage_no, lat, lng,
        speed, course, alt, state, in_route, data_source
      ) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')
    `));
    
    // 3. Stream podatke u CSV formatu
    let streamedRows = 0;
    
    // Promisify stream za async/await
    const streamPromise = new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
    });
    
    for (const row of batch) {
      // Format: tab-separated, \N za NULL vrednosti
      const csvLine = [
        row.time || new Date().toISOString(),
        vehicleId,
        garageNo,
        row.lat || 0,
        row.lng || 0,
        row.speed !== null && row.speed !== undefined ? row.speed : '\\N',
        row.course !== null && row.course !== undefined ? row.course : '\\N',
        row.alt !== null && row.alt !== undefined ? row.alt : '\\N',
        row.state || 0,
        row.in_route || 0,
        'historical_import'
      ].join('\t') + '\n';
      
      const written = stream.write(csvLine);
      if (!written) {
        // Back pressure - čekaj da se buffer oslobodi
        await new Promise(resolve => stream.once('drain', resolve));
      }
      
      streamedRows++;
      
      // Log progress za velike batch-ove
      if (streamedRows % 5000 === 0) {
        this.logger.debug(`[COPY] Streamed ${streamedRows}/${batch.length} rows...`);
      }
    }
    
    // Završi stream
    stream.end();
    await streamPromise;
    
    const streamDuration = Date.now() - startTime;
    this.logger.log(`[COPY] Stream završen: ${streamedRows} redova za ${streamDuration}ms`);
    
    // 4. Prebaci iz temp tabele u glavnu sa ON CONFLICT
    const transferStart = Date.now();
    const result = await client.query(`
      INSERT INTO gps_data 
      SELECT * FROM ${tempTableName}
      ON CONFLICT (vehicle_id, time) DO UPDATE SET
        garage_no = EXCLUDED.garage_no,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        location = EXCLUDED.location,
        speed = EXCLUDED.speed,
        course = EXCLUDED.course,
        alt = EXCLUDED.alt
      RETURNING 1
    `);
    
    const transferDuration = Date.now() - transferStart;
    const totalDuration = Date.now() - startTime;
    
    await client.query('COMMIT');
    
    // Performance logovi
    this.logger.log(
      `✅ [COPY METODA] Vozilo ${garageNo}: ${batch.length} redova\n` +
      `   - Stream: ${streamDuration}ms (${Math.round(batch.length / (streamDuration / 1000))} rows/s)\n` +
      `   - Transfer: ${transferDuration}ms\n` +
      `   - Ukupno: ${totalDuration}ms\n` +
      `   - Inserted/Updated: ${result.rowCount} rows`
    );
    
  } catch (error) {
    await client.query('ROLLBACK');
    this.logger.error(`[COPY ERROR] Vozilo ${garageNo}:`, error);
    
    // Opciono: fallback na batch metodu
    if (this.config.fallbackToBatch) {
      this.logger.warn(`[COPY FALLBACK] Prelazim na batch metodu za vozilo ${garageNo}`);
      await this.insertWithBatch(batch, pool, vehicleId, garageNo);
    } else {
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Postojeća metoda preimenovana
 */
private async insertWithBatch(
  batch: any[],
  pool: Pool,
  vehicleId: number,
  garageNo: string
): Promise<void> {
  // Postojeći kod iz insertBatchToTimescale
  // Samo copy/paste postojeći kod ovde
}

/**
 * Modifikovana glavna metoda koja odlučuje koju metodu koristiti
 */
private async insertBatchToTimescale(
  batch: any[],
  pool: Pool,
  vehicleId: number,
  garageNo: string
): Promise<void> {
  // Odluči koju metodu koristiti
  const method = this.determineInsertMethod(batch.length);
  
  this.logger.debug(
    `[INSERT METHOD] Vozilo ${garageNo}: Koristim ${method} metodu za ${batch.length} redova`
  );
  
  if (method === 'copy') {
    await this.insertWithCopy(batch, pool, vehicleId, garageNo);
  } else {
    await this.insertWithBatch(batch, pool, vehicleId, garageNo);
  }
}

/**
 * Helper metoda za odlučivanje koje metode koristiti
 */
private determineInsertMethod(batchSize: number): 'batch' | 'copy' {
  if (this.config.insertMethod === 'auto') {
    // Auto logika - COPY za velike batch-ove
    return batchSize >= 5000 ? 'copy' : 'batch';
  }
  return this.config.insertMethod || 'batch';
}

// ============================================
// 2. KONFIGURACIJA - INTERFACE I LOADING
// ============================================

/**
 * Dodati u WorkerPoolConfig interface
 */
interface WorkerPoolConfig {
  maxWorkers: number;
  workerTimeout: number;
  retryAttempts: number;
  // NOVO:
  insertMethod: 'batch' | 'copy' | 'auto';
  copyBatchSize: number;
  fallbackToBatch: boolean;
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
}

/**
 * Default konfiguracija - ažurirati postojeću
 */
private config: WorkerPoolConfig = {
  maxWorkers: 3,
  workerTimeout: 600000, // 10 minuta
  retryAttempts: 2,
  // NOVO:
  insertMethod: 'batch',  // default je batch za backward compatibility
  copyBatchSize: 10000,   // veći batch za COPY
  fallbackToBatch: true,  // automatski fallback ako COPY fail-uje
  resourceLimits: {
    maxMemoryMB: 512,
    maxCpuPercent: 25
  }
};

/**
 * Dodati u loadConfiguration metodu
 */
private async loadConfiguration() {
  try {
    const settings = await this.prisma.systemSettings.findMany({
      where: { category: 'legacy_sync' }
    });
    
    settings.forEach(setting => {
      const value = setting.type === 'number' ? parseInt(setting.value) : 
                     setting.type === 'boolean' ? setting.value === 'true' : setting.value;
      
      switch(setting.key) {
        // Postojeći case-ovi...
        
        // NOVO:
        case 'legacy_sync.insert_method':
          this.config.insertMethod = value as 'batch' | 'copy' | 'auto';
          break;
        case 'legacy_sync.copy_batch_size':
          this.config.copyBatchSize = value as number;
          break;
        case 'legacy_sync.fallback_to_batch':
          this.config.fallbackToBatch = value as boolean;
          break;
      }
    });
    
    this.logger.log(
      `✅ Worker Pool konfiguracija učitana:\n` +
      `   - Max Workers: ${this.config.maxWorkers}\n` +
      `   - Insert Method: ${this.config.insertMethod}\n` +
      `   - Copy Batch Size: ${this.config.copyBatchSize}`
    );
  } catch (error) {
    this.logger.warn('Koriste se default Worker Pool podešavanja');
  }
}

// ============================================
// 3. DTO DEFINICIJE
// ============================================

// Kreirati novi fajl: src/gps-sync/dto/copy-config.dto.ts

import { IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CopyConfigDto {
  @ApiProperty({
    enum: ['batch', 'copy', 'auto'],
    description: 'Metoda za insert podataka'
  })
  @IsEnum(['batch', 'copy', 'auto'])
  insertMethod: 'batch' | 'copy' | 'auto';

  @ApiProperty({
    minimum: 1000,
    maximum: 50000,
    description: 'Veličina batch-a za COPY metodu'
  })
  @IsNumber()
  @Min(1000)
  @Max(50000)
  copyBatchSize: number;

  @ApiProperty({
    description: 'Da li da koristi fallback na batch ako COPY fail-uje'
  })
  @IsBoolean()
  fallbackToBatch: boolean;
}

// ============================================
// 4. CONTROLLER ENDPOINTS
// ============================================

// Dodati u legacy-sync.controller.ts

@Get('config/copy')
@RequirePermissions('legacy_sync.manage')
@ApiOperation({ summary: 'Dobavi COPY konfiguraciju' })
@ApiResponse({
  status: 200,
  description: 'COPY konfiguracija',
  type: CopyConfigDto
})
async getCopyConfig(): Promise<CopyConfigDto> {
  const config = await this.workerPoolService.getConfig();
  return {
    insertMethod: config.insertMethod || 'batch',
    copyBatchSize: config.copyBatchSize || 10000,
    fallbackToBatch: config.fallbackToBatch !== false
  };
}

@Patch('config/copy')
@RequirePermissions('legacy_sync.manage')
@ApiOperation({ summary: 'Ažuriraj COPY konfiguraciju' })
@ApiBody({ type: CopyConfigDto })
@ApiResponse({
  status: 200,
  description: 'Konfiguracija ažurirana',
  type: CopyConfigDto
})
async updateCopyConfig(@Body() dto: CopyConfigDto): Promise<CopyConfigDto> {
  try {
    // Sačuvaj u SystemSettings
    await this.prisma.systemSettings.upsert({
      where: { key: 'legacy_sync.insert_method' },
      update: { value: dto.insertMethod },
      create: {
        key: 'legacy_sync.insert_method',
        value: dto.insertMethod,
        type: 'string',
        category: 'legacy_sync',
        description: 'Metoda za insert podataka (batch/copy/auto)'
      }
    });
    
    await this.prisma.systemSettings.upsert({
      where: { key: 'legacy_sync.copy_batch_size' },
      update: { value: dto.copyBatchSize.toString() },
      create: {
        key: 'legacy_sync.copy_batch_size',
        value: dto.copyBatchSize.toString(),
        type: 'number',
        category: 'legacy_sync',
        description: 'Veličina batch-a za COPY metodu'
      }
    });
    
    await this.prisma.systemSettings.upsert({
      where: { key: 'legacy_sync.fallback_to_batch' },
      update: { value: dto.fallbackToBatch.toString() },
      create: {
        key: 'legacy_sync.fallback_to_batch',
        value: dto.fallbackToBatch.toString(),
        type: 'boolean',
        category: 'legacy_sync',
        description: 'Fallback na batch ako COPY fail-uje'
      }
    });
    
    // Reload konfiguraciju u servisu
    await this.workerPoolService.reloadConfig();
    
    this.logger.log('COPY konfiguracija ažurirana', dto);
    return dto;
  } catch (error) {
    this.logger.error('Greška pri ažuriranju COPY konfiguracije', error);
    throw error;
  }
}

// ============================================
// 5. FRONTEND - REACT KOMPONENTE
// ============================================

// SmartSlowSyncDashboard.tsx - Dodati novu sekciju

import { DatabaseOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';

// U komponenti dodati state
const [copyConfig, setCopyConfig] = useState({
  insertMethod: 'batch' as 'batch' | 'copy' | 'auto',
  copyBatchSize: 10000,
  fallbackToBatch: true
});

// Fetch konfiguracije
useEffect(() => {
  fetchCopyConfig();
}, []);

const fetchCopyConfig = async () => {
  try {
    const response = await api.get('/api/legacy-sync/config/copy');
    setCopyConfig(response.data);
  } catch (error) {
    console.error('Greška pri učitavanju COPY konfiguracije:', error);
  }
};

// UI Komponenta
<Card 
  title="Metoda Unosa Podataka" 
  extra={
    <Tooltip title="COPY metoda je 4-10x brža za velike količine podataka">
      <InfoCircleOutlined />
    </Tooltip>
  }
  style={{ marginTop: 16 }}
>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Radio.Group 
      value={copyConfig.insertMethod} 
      onChange={(e) => handleCopyMethodChange(e.target.value)}
      buttonStyle="solid"
    >
      <Radio.Button value="batch">
        <Space>
          <DatabaseOutlined />
          <div>
            <div>Batch INSERT</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              Sigurniji, detaljniji errors
            </div>
          </div>
        </Space>
      </Radio.Button>
      
      <Radio.Button value="copy">
        <Space>
          <RocketOutlined />
          <div>
            <div>COPY</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              4-10x brži za 10K+ redova
            </div>
          </div>
        </Space>
      </Radio.Button>
      
      <Radio.Button value="auto">
        <Space>
          <ThunderboltOutlined />
          <div>
            <div>Automatski</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              COPY za 5K+, Batch za manje
            </div>
          </div>
        </Space>
      </Radio.Button>
    </Radio.Group>
    
    {copyConfig.insertMethod !== 'batch' && (
      <Alert
        message={
          copyConfig.insertMethod === 'copy' 
            ? "COPY metoda aktivna"
            : "Auto mode - sistem bira optimalnu metodu"
        }
        description={
          <>
            <div>• Brzina: {copyConfig.insertMethod === 'copy' ? '~8,000' : '5,000-8,000'} redova/s</div>
            <div>• Batch size: {copyConfig.copyBatchSize.toLocaleString()} redova</div>
            <div>• Fallback: {copyConfig.fallbackToBatch ? 'Da' : 'Ne'}</div>
          </>
        }
        type="info"
        showIcon
      />
    )}
    
    {copyConfig.insertMethod === 'copy' && (
      <Form.Item label="COPY Batch Size">
        <InputNumber
          value={copyConfig.copyBatchSize}
          min={1000}
          max={50000}
          step={1000}
          onChange={(value) => setCopyConfig({...copyConfig, copyBatchSize: value || 10000})}
          addonAfter="redova"
        />
      </Form.Item>
    )}
    
    <Form.Item>
      <Checkbox
        checked={copyConfig.fallbackToBatch}
        onChange={(e) => setCopyConfig({...copyConfig, fallbackToBatch: e.target.checked})}
      >
        Automatski prebaci na Batch ako COPY fail-uje
      </Checkbox>
    </Form.Item>
    
    <Button 
      type="primary" 
      onClick={saveCopyConfig}
      loading={saving}
    >
      Sačuvaj COPY konfiguraciju
    </Button>
  </Space>
</Card>

// Handler funkcije
const handleCopyMethodChange = async (method: string) => {
  setCopyConfig({...copyConfig, insertMethod: method as any});
};

const saveCopyConfig = async () => {
  try {
    setSaving(true);
    await api.patch('/api/legacy-sync/config/copy', copyConfig);
    message.success('COPY konfiguracija sačuvana');
  } catch (error) {
    message.error('Greška pri čuvanju konfiguracije');
  } finally {
    setSaving(false);
  }
};

// ============================================
// 6. PACKAGE.JSON DEPENDENCIES
// ============================================

// Dodati u apps/backend/package.json
{
  "dependencies": {
    "pg-copy-streams": "^6.0.6"
  },
  "devDependencies": {
    "@types/pg-copy-streams": "^1.2.2"
  }
}

// ============================================
// 7. PRISMA SEED ZA DEVELOPMENT
// ============================================

// Dodati u prisma/seed.ts
await prisma.systemSettings.createMany({
  data: [
    {
      key: 'legacy_sync.insert_method',
      value: 'batch',
      type: 'string',
      category: 'legacy_sync',
      description: 'Metoda za insert podataka (batch/copy/auto)'
    },
    {
      key: 'legacy_sync.copy_batch_size',
      value: '10000',
      type: 'number',
      category: 'legacy_sync',
      description: 'Veličina batch-a za COPY metodu'
    },
    {
      key: 'legacy_sync.fallback_to_batch',
      value: 'true',
      type: 'boolean',
      category: 'legacy_sync',
      description: 'Fallback na batch ako COPY fail-uje'
    }
  ],
  skipDuplicates: true
});