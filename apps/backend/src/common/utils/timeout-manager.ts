import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class TimeoutManager {
  private readonly logger = new Logger(TimeoutManager.name);
  
  // Predefinisani timeout-i za različite operacije
  public readonly timeouts = {
    SSH_COUNT: 30000,      // 30 sekundi za COUNT query
    SSH_EXPORT: 300000,    // 5 minuta za mysqldump
    SCP_TRANSFER: 180000,  // 3 minuta za file transfer
    DB_IMPORT: 240000,     // 4 minuta za database import
    CLEANUP: 15000,        // 15 sekundi za cleanup
    WORKER_TOTAL: 600000,  // 10 minuta ukupno po worker-u
    SSH_CONNECT: 10000,    // 10 sekundi za SSH konekciju
    AGGRESSIVE_DETECT: 60000, // 1 minut za aggressive driving detekciju
  };

  /**
   * Izvršava Promise sa timeout-om
   * @param operation Promise koji treba izvršiti
   * @param timeoutMs Timeout u milisekundama
   * @param operationName Naziv operacije za logging
   * @returns Rezultat Promise-a
   * @throws TimeoutError ako operacija prekorači timeout
   */
  async execWithTimeout<T>(
    operation: Promise<T>, 
    timeoutMs: number, 
    operationName: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const errorMsg = `${operationName} timeout after ${timeoutMs}ms`;
        this.logger.error(errorMsg);
        reject(new TimeoutError(errorMsg));
      }, timeoutMs);
    });

    try {
      // Race između operacije i timeout-a
      const result = await Promise.race([operation, timeoutPromise]);
      clearTimeout(timeoutHandle!);
      this.logger.debug(`${operationName} completed successfully within ${timeoutMs}ms`);
      return result;
    } catch (error) {
      clearTimeout(timeoutHandle!);
      
      if (error instanceof TimeoutError) {
        this.logger.error(`⏱️ TIMEOUT: ${operationName} nije završen u ${timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Wrapper za exec komande sa timeout-om
   * @param command Shell komanda za izvršavanje
   * @param timeoutMs Timeout u milisekundama
   * @param operationName Naziv operacije za logging
   * @returns stdout i stderr iz komande
   */
  async execCommand(
    command: string, 
    timeoutMs: number,
    operationName: string
  ): Promise<{ stdout: string; stderr: string }> {
    this.logger.debug(`Executing ${operationName} with ${timeoutMs}ms timeout`);
    
    // Skrati komandu za log (sakrij sensitive podatke)
    const logCommand = command.length > 100 
      ? command.substring(0, 100) + '...' 
      : command;
    this.logger.debug(`Command: ${logCommand}`);
    
    return this.execWithTimeout(
      execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer za velike output-e
        encoding: 'utf8'
      }),
      timeoutMs,
      operationName
    );
  }

  /**
   * Izvršava SSH komandu sa timeout-om i connection timeout-om
   * @param sshCommand SSH komanda
   * @param sshKeyPath Putanja do SSH ključa
   * @param host SSH host
   * @param timeoutMs Timeout za celu operaciju
   * @param operationName Naziv operacije
   */
  async execSSHCommand(
    sshCommand: string,
    sshKeyPath: string,
    host: string,
    timeoutMs: number,
    operationName: string
  ): Promise<{ stdout: string; stderr: string }> {
    // Dodaj SSH opcije za connection timeout i server alive
    const fullCommand = `ssh -i ${sshKeyPath} \
      -o ConnectTimeout=10 \
      -o ServerAliveInterval=10 \
      -o ServerAliveCountMax=3 \
      -o StrictHostKeyChecking=no \
      root@${host} "${sshCommand}"`;
    
    return this.execCommand(fullCommand, timeoutMs, operationName);
  }

  /**
   * Izvršava SCP transfer sa timeout-om
   * @param source Source putanja
   * @param destination Destination putanja
   * @param sshKeyPath SSH ključ
   * @param timeoutMs Timeout
   * @param operationName Naziv operacije
   */
  async execSCPTransfer(
    source: string,
    destination: string,
    sshKeyPath: string,
    timeoutMs: number,
    operationName: string
  ): Promise<void> {
    const scpCommand = `scp -i ${sshKeyPath} \
      -o ConnectTimeout=10 \
      -o ServerAliveInterval=10 \
      -o ServerAliveCountMax=3 \
      -o StrictHostKeyChecking=no \
      ${source} ${destination}`;
    
    await this.execCommand(scpCommand, timeoutMs, operationName);
    this.logger.log(`✅ SCP transfer completed: ${operationName}`);
  }

  /**
   * Izvršava operaciju sa worker timeout-om
   * Ovo je wrapper za ceo worker proces
   */
  async execWithWorkerTimeout<T>(
    workerOperation: Promise<T>,
    vehicleId: number,
    workerId: number
  ): Promise<T> {
    try {
      return await this.execWithTimeout(
        workerOperation,
        this.timeouts.WORKER_TOTAL,
        `Worker ${workerId} for vehicle ${vehicleId}`
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.error(
          `🔴 Worker ${workerId} timeout za vozilo ${vehicleId}! ` +
          `Worker će biti označen kao failed.`
        );
      }
      throw error;
    }
  }
}