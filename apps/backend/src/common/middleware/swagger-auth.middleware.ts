import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class SwaggerAuthMiddleware implements NestMiddleware {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Dozvoli pristup static resursima (CSS, JS, favicon) bez autentifikacije
    if (
      req.originalUrl.includes('.css') ||
      req.originalUrl.includes('.js') ||
      req.originalUrl.includes('.png') ||
      req.originalUrl.includes('.ico') ||
      req.originalUrl.includes('favicon')
    ) {
      return next();
    }

    // Ekstraktuj API ključ
    const apiKey = this.extractApiKey(req);

    if (!apiKey) {
      return this.sendUnauthorizedResponse(res);
    }

    try {
      // Validacija API ključa
      const validKey = await this.apiKeysService.validateApiKey(
        apiKey,
        req.ip,
        req.get('User-Agent'),
        req.originalUrl,
        req.method,
      );

      if (!validKey) {
        return this.sendUnauthorizedResponse(res);
      }

      // Jednostavno: bilo koji valjan API ključ može da pristupi Swagger-u
      // (kao što rade Vercel, DigitalOcean, GitHub...)

      // Dodaj korisnika u request za audit
      (req as any).apiKey = {
        id: validKey.id,
        displayKey: validKey.displayKey,
        userId: validKey.createdBy,
      };

      next();
    } catch (error) {
      console.error('Swagger middleware error:', error);
      return this.sendUnauthorizedResponse(res);
    }
  }

  private extractApiKey(request: Request): string | null {
    // 1. Header: X-API-Key
    let apiKey = request.get('X-API-Key');
    if (apiKey) return apiKey;

    // 2. Header: Authorization: Bearer
    const authHeader = request.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
      if (apiKey.startsWith('sk_')) return apiKey;
    }

    // 3. Query parameter: api_key
    apiKey = request.query.api_key as string;
    if (apiKey) return apiKey;

    return null;
  }

  private sendUnauthorizedResponse(response: Response): void {
    response.status(401).json({
      message: 'API ključ je obavezan za pristup Swagger dokumentaciji',
      error: 'Unauthorized',
      statusCode: 401,
      hint: 'Dodajte API ključ kao X-API-Key header ili ?api_key=YOUR_KEY u URL',
      examples: [
        'http://localhost:3010/api/docs?api_key=sk_prod_swagger_...',
        'Ili dodajte X-API-Key: sk_prod_swagger_... header',
      ],
    });
  }

  private sendForbiddenResponse(response: Response): void {
    response.status(403).json({
      message: 'API ključ nije valjan ili je istekao',
      error: 'Forbidden',
      statusCode: 403,
      hint: 'Potreban je bilo koji aktivan API ključ',
    });
  }
}
