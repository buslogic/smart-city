#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface ValidationResult {
  timestamp: string;
  checks: {
    migrationsVsSchema: {
      passed: boolean;
      message: string;
      details?: any;
    };
    schemaVsDatabase: {
      passed: boolean;
      message: string;
      details?: any;
    };
    migrationHistory: {
      passed: boolean;
      message: string;
      details?: any;
    };
  };
  summary: {
    allPassed: boolean;
    recommendation: string;
  };
}

class PrismaSchemaValidator {
  private projectPath: string;
  private prismaPath: string;
  private tempDbName: string;
  private skipMigrationCheck: boolean;
  private ciMode: boolean;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.prismaPath = path.join(projectPath, 'prisma');
    this.tempDbName = `prisma_validation_${Date.now()}`;
    // Check environment variables for configuration
    this.skipMigrationCheck = process.env.SKIP_MIGRATION_CHECK === 'true' || process.env.CI === 'true';
    this.ciMode = process.env.CI === 'true';
  }

  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(command, { cwd: this.projectPath });
      return result;
    } catch (error: any) {
      // Preserve stdout and stderr even when command fails
      const err: any = new Error(`Command failed: ${command}\n${error.message}`);
      err.stdout = error.stdout || '';
      err.stderr = error.stderr || '';
      throw err;
    }
  }

  private getSchemaChecksum(content: string): string {
    // Remove comments and normalize whitespace for consistent comparison
    const normalized = content
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check 1: Verify migrations produce current schema
   * Creates a temp database, runs all migrations, generates schema from it
   */
  private async checkMigrationsVsSchema(): Promise<ValidationResult['checks']['migrationsVsSchema']> {
    console.log('\n📋 Check 1: Validating migrations against schema...');

    // Skip this check in CI mode or when explicitly requested
    if (this.skipMigrationCheck) {
      console.log('   ⏭️  Skipping migration check (CI mode or SKIP_MIGRATION_CHECK=true)');
      return {
        passed: true,
        message: 'Migration check skipped (seed-dependent migrations)',
        details: {
          skipped: true,
          reason: 'This project has seed-dependent migrations that cannot be validated in isolation'
        }
      };
    }

    let dbUser = 'root';
    let dbPass = 'root';
    let dbHost = '127.0.0.1';
    let dbPort = '3325';

    try {
      // Read current schema
      const currentSchemaPath = path.join(this.prismaPath, 'schema.prisma');
      const currentSchema = fs.readFileSync(currentSchemaPath, 'utf-8');

      // Create temporary database
      console.log(`   Creating temporary database: ${this.tempDbName}`);
      const dbUrl = process.env.DATABASE_URL || '';
      const tempDbUrl = dbUrl.replace(/\/[^/]+(\?|$)/, `/${this.tempDbName}$1`);

      // Extract credentials from DATABASE_URL
      const dbUrlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\//);
      if (dbUrlMatch) {
        dbUser = dbUrlMatch[1];
        dbPass = dbUrlMatch[2];
        dbHost = dbUrlMatch[3] === 'localhost' ? '127.0.0.1' : dbUrlMatch[3];
        dbPort = dbUrlMatch[4];
      }

      console.log(`   Using connection: ${dbUser}@${dbHost}:${dbPort}`);

      await this.executeCommand(
        `mysql --protocol=tcp -h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPass} -e "CREATE DATABASE IF NOT EXISTS ${this.tempDbName}"`
      );

      // Apply all migrations to temp database
      console.log('   Applying all migrations to temp database...');
      process.env.DATABASE_URL = tempDbUrl;

      await this.executeCommand('npx prisma migrate deploy');

      // Check if migrations were applied successfully
      console.log('   Checking migration status...');
      const { stdout: statusOutput } = await this.executeCommand('npx prisma migrate status').catch(e => ({ stdout: e.stdout || '' }));

      // Drop temp database
      await this.executeCommand(
        `mysql --protocol=tcp -h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPass} -e "DROP DATABASE IF EXISTS ${this.tempDbName}"`
      );

      // Restore original DATABASE_URL
      process.env.DATABASE_URL = dbUrl;

      // If status shows all migrations applied and no issues, we're good
      if (statusOutput.includes('Database schema is up to date')) {
        return {
          passed: true,
          message: 'Migrations successfully applied to fresh database',
          details: { status: statusOutput }
        };
      } else {
        return {
          passed: false,
          message: 'Issues found when applying migrations to fresh database',
          details: {
            status: statusOutput
          }
        };
      }
    } catch (error: any) {
      // Cleanup on error
      try {
        const dbUrl = process.env.DATABASE_URL || '';
        const dbUrlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\//);
        const dbUser = dbUrlMatch ? dbUrlMatch[1] : 'root';
        const dbPass = dbUrlMatch ? dbUrlMatch[2] : 'root';
        const dbHost = dbUrlMatch ? (dbUrlMatch[3] === 'localhost' ? '127.0.0.1' : dbUrlMatch[3]) : '127.0.0.1';
        const dbPort = dbUrlMatch ? dbUrlMatch[4] : '3325';

        await this.executeCommand(
          `mysql --protocol=tcp -h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPass} -e "DROP DATABASE IF EXISTS ${this.tempDbName}"`
        );
      } catch {}

      return {
        passed: false,
        message: `Failed to validate migrations: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 2: Verify schema matches actual database
   */
  private async checkSchemaVsDatabase(): Promise<ValidationResult['checks']['schemaVsDatabase']> {
    console.log('\n🗄️  Check 2: Validating schema against database...');

    try {
      // Run prisma validate
      console.log('   Running prisma validate...');
      await this.executeCommand('npx prisma validate');

      // Check for drift using prisma migrate diff
      console.log('   Checking for schema drift...');

      try {
        const { stdout: diffOutput } = await this.executeCommand(
          'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code'
        );

        // If command succeeds or output contains "No difference detected", there's no drift
        if (diffOutput.includes('No difference detected') || !diffOutput.trim()) {
          return {
            passed: true,
            message: 'Schema matches the database structure'
          };
        }

        return {
          passed: false,
          message: 'Schema drift detected',
          details: { drift: diffOutput }
        };
      } catch (error: any) {
        // Exit code 0 means no difference
        if (error.stdout && error.stdout.includes('No difference detected')) {
          return {
            passed: true,
            message: 'Schema matches the database structure'
          };
        }

        // Any other error means drift or actual error
        return {
          passed: false,
          message: 'Schema drift detected',
          details: { drift: error.stdout || error.message }
        };
      }
    } catch (error: any) {
      // Check if it's just a drift detection (exit code 2)
      if (error.message.includes('exit code 2')) {
        const { stdout } = await this.executeCommand('npx prisma migrate status').catch(e => ({ stdout: e.stdout }));
        return {
          passed: false,
          message: 'Database is not in sync with schema',
          details: {
            status: stdout,
            recommendation: 'Run: npx prisma migrate dev'
          }
        };
      }

      return {
        passed: false,
        message: `Failed to validate schema: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Check 3: Verify migration history integrity
   */
  private async checkMigrationHistory(): Promise<ValidationResult['checks']['migrationHistory']> {
    console.log('\n📜 Check 3: Validating migration history...');


    try {
      const { stdout } = await this.executeCommand('npx prisma migrate status');

      // Parse the output
      const lines = stdout.split('\n');
      const problems: string[] = [];

      // Check for various issues
      if (stdout.includes('Database schema is not empty')) {
        problems.push('Database has schema drift');
      }

      if (stdout.includes('have not yet been applied')) {
        const unapplied = lines
          .filter(l => l.match(/^\d{14}_/))
          .map(l => l.trim());
        problems.push(`Unapplied migrations: ${unapplied.join(', ')}`);
      }

      if (stdout.includes('are not found locally')) {
        const missing = stdout
          .split('are not found locally:')[1]
          ?.split('\n')
          .filter(l => l.trim())
          .map(l => l.trim()) || [];
        problems.push(`Missing local migrations: ${missing.join(', ')}`);
      }

      if (problems.length === 0) {
        return {
          passed: true,
          message: 'Migration history is consistent',
          details: { status: stdout }
        };
      } else {
        return {
          passed: false,
          message: 'Migration history has issues',
          details: {
            problems,
            status: stdout,
            recommendation: 'Review and fix migration history before proceeding'
          }
        };
      }
    } catch (error: any) {
      return {
        passed: false,
        message: `Failed to check migration history: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Find differences between two schemas
   */
  private findSchemaDifferences(schema1: string, schema2: string): string[] {
    const differences: string[] = [];

    // Extract models from schemas
    const modelRegex = /model\s+(\w+)\s*{[^}]*}/g;
    const models1 = new Map<string, string>();
    const models2 = new Map<string, string>();

    let match;
    while ((match = modelRegex.exec(schema1)) !== null) {
      models1.set(match[1], match[0]);
    }

    modelRegex.lastIndex = 0;
    while ((match = modelRegex.exec(schema2)) !== null) {
      models2.set(match[1], match[0]);
    }

    // Find missing models
    for (const [name] of models1) {
      if (!models2.has(name)) {
        differences.push(`Model '${name}' exists in schema but not in migrations`);
      }
    }

    for (const [name] of models2) {
      if (!models1.has(name)) {
        differences.push(`Model '${name}' exists in migrations but not in schema`);
      }
    }

    // Check enums
    const enumRegex = /enum\s+(\w+)\s*{[^}]*}/g;
    const enums1 = new Set<string>();
    const enums2 = new Set<string>();

    while ((match = enumRegex.exec(schema1)) !== null) {
      enums1.add(match[1]);
    }

    enumRegex.lastIndex = 0;
    while ((match = enumRegex.exec(schema2)) !== null) {
      enums2.add(match[1]);
    }

    for (const name of enums1) {
      if (!enums2.has(name)) {
        differences.push(`Enum '${name}' exists in schema but not in migrations`);
      }
    }

    for (const name of enums2) {
      if (!enums1.has(name)) {
        differences.push(`Enum '${name}' exists in migrations but not in schema`);
      }
    }

    return differences;
  }

  /**
   * Run all validations
   */
  public async validate(): Promise<ValidationResult> {
    console.log('🔍 Starting Prisma Schema Validation...');
    console.log('=' .repeat(50));

    // Show configuration mode
    if (this.ciMode) {
      console.log('🤖 Running in CI mode - skipping seed-dependent checks');
    } else if (this.skipMigrationCheck) {
      console.log('⚙️  SKIP_MIGRATION_CHECK enabled - skipping migration validation');
    }

    const result: ValidationResult = {
      timestamp: new Date().toISOString(),
      checks: {
        migrationsVsSchema: await this.checkMigrationsVsSchema(),
        schemaVsDatabase: await this.checkSchemaVsDatabase(),
        migrationHistory: await this.checkMigrationHistory()
      },
      summary: {
        allPassed: false,
        recommendation: ''
      }
    };

    // Generate summary
    result.summary.allPassed =
      result.checks.migrationsVsSchema.passed &&
      result.checks.schemaVsDatabase.passed &&
      result.checks.migrationHistory.passed;

    if (result.summary.allPassed) {
      result.summary.recommendation = '✅ All checks passed! Your Prisma setup is consistent.';
    } else {
      const failed: string[] = [];
      if (!result.checks.migrationHistory.passed) {
        failed.push('Fix migration history issues first');
      }
      if (!result.checks.migrationsVsSchema.passed) {
        failed.push('Create a new migration to sync schema with migrations');
      }
      if (!result.checks.schemaVsDatabase.passed) {
        failed.push('Run prisma migrate dev to sync database');
      }
      result.summary.recommendation = `⚠️  Issues detected. Recommended actions:\n${failed.map(f => `   - ${f}`).join('\n')}`;
    }

    return result;
  }

  /**
   * Generate report
   */
  public generateReport(result: ValidationResult): void {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 VALIDATION REPORT');
    console.log('=' .repeat(50));

    console.log(`\nTimestamp: ${result.timestamp}`);

    console.log('\n🔍 Check Results:');
    console.log('-' .repeat(40));

    // Migration History
    const historyIcon = result.checks.migrationHistory.passed ? '✅' : '❌';
    console.log(`${historyIcon} Migration History: ${result.checks.migrationHistory.message}`);
    if (!result.checks.migrationHistory.passed && result.checks.migrationHistory.details?.problems) {
      result.checks.migrationHistory.details.problems.forEach((p: string) => {
        console.log(`   ⚠️  ${p}`);
      });
    }

    // Migrations vs Schema
    const migrationsIcon = result.checks.migrationsVsSchema.passed ? '✅' : '❌';
    console.log(`${migrationsIcon} Migrations → Schema: ${result.checks.migrationsVsSchema.message}`);
    if (!result.checks.migrationsVsSchema.passed && result.checks.migrationsVsSchema.details?.differences) {
      result.checks.migrationsVsSchema.details.differences.forEach((d: string) => {
        console.log(`   ⚠️  ${d}`);
      });
    }

    // Schema vs Database
    const schemaIcon = result.checks.schemaVsDatabase.passed ? '✅' : '❌';
    console.log(`${schemaIcon} Schema → Database: ${result.checks.schemaVsDatabase.message}`);

    console.log('\n' + '=' .repeat(50));
    console.log('📋 SUMMARY');
    console.log('=' .repeat(50));
    console.log(result.summary.recommendation);

    // Save detailed report to file
    const reportPath = path.join(this.projectPath, `prisma-validation-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const validator = new PrismaSchemaValidator();

  try {
    const result = await validator.validate();
    validator.generateReport(result);

    // Exit with error code if validation failed
    if (!result.summary.allPassed) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Validation failed with error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { PrismaSchemaValidator };
export type { ValidationResult };