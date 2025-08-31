import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    // Validacija session-a
    const session = await this.prisma.session.findUnique({
      where: {
        id: payload.sessionId,
        token: payload.sessionId,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session je istekla');
    }

    // Učitavanje korisnika sa ulogama i permisijama
    const user = await this.prisma.user.findUnique({
      where: { 
        id: payload.sub,
        isActive: true,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Korisnik nije pronađen ili nije aktivan');
    }

    // Formatiranje podataka o korisniku
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => `${rp.permission.resource}:${rp.permission.action}`)
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles,
      permissions: [...new Set(permissions)], // uklanjanje duplikata
      sessionId: payload.sessionId,
    };
  }
}