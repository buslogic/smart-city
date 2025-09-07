import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  operationName?: string;
  shouldRetry?: (error: any, attemptNumber: number) => boolean;
  onRetry?: (error: any, attemptNumber: number, nextDelayMs: number) => void;
}

export class RetryManager {
  private readonly logger = new Logger(RetryManager.name);

  /**
   * Izvršava operaciju sa automatskim retry i exponential backoff
   * @param operation Funkcija koja vraća Promise
   * @param options Retry opcije
   * @returns Rezultat operacije
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      operationName = 'operation',
      shouldRetry = () => true,
      onRetry = () => {}
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(`${operationName}: pokušaj ${attempt}/${maxAttempts}`);
        
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.log(`✅ ${operationName} uspešan nakon ${attempt} pokušaja`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Proveri da li treba retry
        if (!shouldRetry(error, attempt) || attempt === maxAttempts) {
          this.logger.error(
            `❌ ${operationName} neuspešan nakon ${attempt} pokušaja: ${error.message}`
          );
          throw error;
        }
        
        // Izračunaj delay sa exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        
        this.logger.warn(
          `⚠️ ${operationName} neuspešan (pokušaj ${attempt}/${maxAttempts}), ` +
          `retry za ${delay}ms. Greška: ${error.message}`
        );
        
        // Callback za custom handling
        onRetry(error, attempt, delay);
        
        // Čekaj pre sledećeg pokušaja
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Retry sa fiksnim delay-em (bez backoff)
   */
  async retryWithFixedDelay<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    operationName: string = 'operation'
  ): Promise<T> {
    return this.retryWithBackoff(operation, {
      maxAttempts,
      initialDelayMs: delayMs,
      maxDelayMs: delayMs,
      backoffMultiplier: 1, // Bez backoff
      operationName
    });
  }

  /**
   * Retry samo za određene tipove grešaka
   */
  async retryOnSpecificErrors<T>(
    operation: () => Promise<T>,
    retryableErrors: string[],
    options: RetryOptions = {}
  ): Promise<T> {
    return this.retryWithBackoff(operation, {
      ...options,
      shouldRetry: (error) => {
        // Retry samo ako je greška u listi retryable grešaka
        return retryableErrors.some(retryableError => 
          error.message?.includes(retryableError) ||
          error.code === retryableError
        );
      }
    });
  }

  /**
   * Pametni retry za SSH/mrežne operacije
   */
  async retryNetworkOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const networkErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT', 
      'ECONNRESET',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'Connection timed out',
      'Connection refused',
      'No route to host',
      'Network is unreachable',
      'Connection reset by peer',
      'Timeout'
    ];

    return this.retryWithBackoff(operation, {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      operationName,
      shouldRetry: (error, attemptNumber) => {
        // Prva 2 pokušaja za sve network greške
        if (attemptNumber <= 2) {
          const isNetworkError = networkErrors.some(netErr => 
            error.message?.includes(netErr) || error.code === netErr
          );
          
          if (isNetworkError) {
            this.logger.warn(`🔄 Network error detected, will retry: ${error.message}`);
            return true;
          }
        }
        
        // Treći pokušaj samo za timeout
        if (attemptNumber === 3) {
          return error.message?.includes('Timeout') || error.code === 'ETIMEDOUT';
        }
        
        return false;
      },
      onRetry: (error, attempt, delay) => {
        if (attempt === 2) {
          this.logger.warn(`⚠️ Mrežni problemi persistiraju, poslednji pokušaj za ${delay}ms...`);
        }
      }
    });
  }

  /**
   * Helper za sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry sa progresivnim timeout-om
   * Povećava timeout sa svakim pokušajem
   */
  async retryWithProgressiveTimeout<T>(
    operation: (timeoutMs: number) => Promise<T>,
    initialTimeoutMs: number = 10000,
    maxTimeoutMs: number = 60000,
    operationName: string = 'operation'
  ): Promise<T> {
    const attempts = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      // Progresivno povećaj timeout
      const timeoutMs = Math.min(
        initialTimeoutMs * attempt,
        maxTimeoutMs
      );
      
      try {
        this.logger.debug(
          `${operationName}: pokušaj ${attempt}/${attempts} sa timeout ${timeoutMs}ms`
        );
        
        return await operation(timeoutMs);
      } catch (error) {
        lastError = error;
        
        if (attempt === attempts) {
          throw error;
        }
        
        // Duži delay za timeout greške
        const delay = error.message?.includes('timeout') ? 5000 : 2000;
        
        this.logger.warn(
          `Retry ${attempt}/${attempts} za ${operationName} nakon ${delay}ms`
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
}