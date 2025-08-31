import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
  Get 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiBearerAuth 
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Prijava korisnika' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Uspešna prijava',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neispravni podaci za prijavu',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
  ): Promise<LoginResponseDto> {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    
    // req.user je dostupan posle LocalAuthGuard validacije
    return this.authService.loginWithUser(req.user, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Osvežavanje access token-a' })
  @ApiResponse({
    status: 200,
    description: 'Token uspešno osvežen',
  })
  @ApiResponse({
    status: 401,
    description: 'Nevažeći refresh token',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Odjava korisnika' })
  @ApiResponse({
    status: 200,
    description: 'Uspešna odjava',
  })
  async logout(@CurrentUser() user: any) {
    await this.authService.logout(user.id, user.sessionId);
    return { message: 'Uspešno ste se odjavili' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Odjava sa svih uređaja' })
  @ApiResponse({
    status: 200,
    description: 'Uspešna odjava sa svih uređaja',
  })
  async logoutAll(@CurrentUser() user: any) {
    await this.authService.logoutAll(user.id);
    return { message: 'Uspešno ste se odjavili sa svih uređaja' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trenutni korisnik' })
  @ApiResponse({
    status: 200,
    description: 'Podaci o trenutnom korisniku',
  })
  async getProfile(@CurrentUser() user: any) {
    return { user };
  }
}