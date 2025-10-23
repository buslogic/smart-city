import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Custom guard za SSE endpointe koji podržava token iz query string-a
 * EventSource ne podržava custom headers, pa token mora da se pošalje kao query parametar
 */
@Injectable()
export class SseAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(SseAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    this.logger.log('SseAuthGuard pozvan za SSE endpoint');

    // Ako postoji token u query parametru, postavi ga u Authorization header
    const tokenFromQuery = request.query.token;

    if (tokenFromQuery) {
      this.logger.log('Token pronađen u query parametru, postavljam u header');
      // Postavi token u Authorization header kako bi parent guard mogao da ga obradi
      request.headers.authorization = `Bearer ${tokenFromQuery}`;
    } else {
      this.logger.error('Token nije pronađen u query parametru - odbijam zahtev');
      throw new UnauthorizedException(
        'Token nije pronađen u query parametrima',
      );
    }

    // Pozovi parent guard da verifikuje token
    this.logger.log('Pozivam parent JWT guard za validaciju');
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    this.logger.log('handleRequest pozvan u SseAuthGuard');

    if (err) {
      this.logger.error('Greška tokom autentifikacije:', err);
      throw err;
    }

    if (!user) {
      this.logger.error('Korisnik nije pronađen posle JWT validacije');
      throw new UnauthorizedException('Nevažeći token');
    }

    this.logger.log('Autentifikacija uspešna za korisnika:', user.sub);
    return user;
  }
}
