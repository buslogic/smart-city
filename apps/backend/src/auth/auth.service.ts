import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
        avatar: true,
        isActive: true,
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

    const userResult = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar || null,
      isActive: user.isActive,
      roles,
      permissions: [...new Set(permissions)],
    };
    
    return userResult;
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
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isActive: true,
          refreshToken: true,
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
        avatar: user.avatar || null,
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

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Ne otkrivamo da li email postoji u sistemu
    if (!user) {
      this.logger.log(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generiši reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Sačuvaj hash tokena u bazi (trebalo bi dodati reset_token i reset_token_expires polja u User model)
    // Za sada ćemo koristiti refreshToken polje privremeno
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 sata

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: `reset_${resetTokenHash}_${expiresAt.toISOString()}`,
      },
    });

    // Pošalji email
    try {
      await this.mailService.sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName,
        resetToken,
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${user.email}:`, error);
      throw new BadRequestException('Greška pri slanju emaila za resetovanje lozinke');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Hash-uj token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Pronađi korisnika sa ovim tokenom
    const users = await this.prisma.user.findMany({
      where: {
        refreshToken: {
          contains: `reset_${tokenHash}`,
        },
      },
    });

    if (users.length === 0) {
      throw new BadRequestException('Neispravan ili istekao token za resetovanje lozinke');
    }

    const user = users[0];

    // Proveri da li je token istekao
    const tokenParts = user.refreshToken?.split('_');
    if (tokenParts && tokenParts.length === 3) {
      const expiresAt = new Date(tokenParts[2]);
      if (expiresAt < new Date()) {
        throw new BadRequestException('Token za resetovanje lozinke je istekao');
      }
    }

    // Hash-uj novu lozinku
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Ažuriraj lozinku i obriši reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });

    // Obriši sve postojeće sesije korisnika
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    this.logger.log(`Password reset successful for user ${user.email}`);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    // Pronađi korisnika
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        email: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Korisnik nije pronađen');
    }

    // Proveri trenutnu lozinku
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Trenutna lozinka nije ispravna');
    }

    // Proveri da nova lozinka nije ista kao trenutna
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('Nova lozinka mora biti različita od trenutne');
    }

    // Hash-uj novu lozinku
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Ažuriraj lozinku
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    this.logger.log(`Password changed successfully for user ${user.email}`);
  }
}