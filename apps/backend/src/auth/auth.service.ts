import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
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
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Korisnički nalog je deaktiviran');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Formatiranje korisničkih podataka
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles,
      permissions: [...new Set(permissions)],
    };
  }

  async loginWithUser(user: any, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto> {

    // Kreiranje session-a
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 sata

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        token: sessionId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Ažuriranje poslednjeg logovanja
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Kreiranje JWT tokena
    const payload = {
      sub: user.id,
      email: user.email,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '7d',
    });

    // Čuvanje refresh token-a u bazu
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user,
      expiresIn: 15 * 60, // 15 minuta u sekundama
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Neispravni podaci za prijavu');
    }

    return this.loginWithUser(user, ipAddress, userAgent);
  }

  async refreshToken(refreshToken: string): Promise<Omit<LoginResponseDto, 'refreshToken'>> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
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

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Nevažeći refresh token');
      }

      const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Nevažeći refresh token');
      }

      // Proverava da li session postoji
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session) {
        throw new UnauthorizedException('Session je istekla');
      }

      // Kreiranje novog access token-a
      const newPayload = {
        sub: user.id,
        email: user.email,
        sessionId: payload.sessionId,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_EXPIRATION') || '15m',
      });

      // Formatiranje korisničkih podataka
      const roles = user.roles.map(ur => ur.role.name);
      const permissions = user.roles.flatMap(ur =>
        ur.role.permissions.map(rp => rp.permission.name)
      );

      const userInfo = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles,
        permissions: [...new Set(permissions)],
      };

      return {
        accessToken,
        user: userInfo,
        expiresIn: 15 * 60,
      };
    } catch (error) {
      throw new UnauthorizedException('Nevažeći refresh token');
    }
  }

  async logout(userId: number, sessionId: string): Promise<void> {
    // Brisanje session-a
    await this.prisma.session.deleteMany({
      where: {
        userId,
        id: sessionId,
      },
    });

    // Brisanje refresh token-a
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async logoutAll(userId: number): Promise<void> {
    // Brisanje svih session-a korisnika
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    // Brisanje refresh token-a
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}