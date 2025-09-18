import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class SwaggerAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Ekstraktuj API ključ iz različitih izvora
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.sendUnauthorizedResponse(response);
      return false;
    }

    try {
      // Koristi postojeći ApiKeysService za validaciju
      const validKey = await this.apiKeysService.validateApiKey(
        apiKey,
        request.ip,
        request.get('User-Agent'),
        request.originalUrl,
        request.method,
      );

      if (!validKey) {
        this.sendUnauthorizedResponse(response);
        return false;
      }

      // Proverava da li ključ ima SWAGGER_ACCESS tip ili swagger permisiju
      const hasSwaggerAccess =
        validKey.type === 'SWAGGER_ACCESS' ||
        validKey.type === 'ADMIN_ACCESS' ||
        (validKey.permissions &&
          JSON.parse(validKey.permissions as string).includes('swagger:read'));

      if (!hasSwaggerAccess) {
        this.sendForbiddenResponse(response);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Swagger auth error:', error);
      this.sendUnauthorizedResponse(response);
      return false;
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
      hint: 'Dodajte API ključ kao X-API-Key header, Bearer token, ili ?api_key query parameter',
    });
  }

  private sendForbiddenResponse(response: Response): void {
    response.status(403).json({
      message: 'API ključ nema dozvolu za pristup Swagger dokumentaciji',
      error: 'Forbidden',
      statusCode: 403,
      hint: 'Potreban je API ključ tipa SWAGGER_ACCESS, ADMIN_ACCESS ili sa swagger:read permisijom',
    });
  }
}
