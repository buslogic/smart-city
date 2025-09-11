import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto, RevokeApiKeyDto } from './dto/update-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto, ApiKeyLogResponseDto } from './dto/api-key-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('API Keys Management')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('test')
  @Public()
  async test() {
    return { message: 'API Keys endpoint je aktivan', timestamp: new Date() };
  }

  @Post()
  @RequirePermissions('api_keys:create')
  @ApiOperation({ 
    summary: 'Kreira novi API ključ',
    description: 'Generiše novi sigurni API ključ. NAPOMENA: Ključ se prikazuje samo jednom!'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'API ključ uspešno kreiran',
    type: CreateApiKeyResponseDto
  })
  @ApiResponse({ status: 400, description: 'Neispravni podaci' })
  @ApiResponse({ status: 409, description: 'Konflikt - ključ već postoji' })
  async create(@Request() req, @Body() createApiKeyDto: CreateApiKeyDto): Promise<CreateApiKeyResponseDto> {
    return this.apiKeysService.create(createApiKeyDto, req.user.id);
  }

  @Get()
  @RequirePermissions('api_keys:view')
  @ApiOperation({ 
    summary: 'Lista svih API ključeva',
    description: 'Vraća listu API ključeva (bez raw vrednosti ključa)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista API ključeva',
    type: [ApiKeyResponseDto]
  })
  async findAll(
    @Request() req,
    @Query('userId') userId?: string,
  ): Promise<ApiKeyResponseDto[]> {
    // Admin može da vidi sve ključeve, ostali samo svoje
    const filterUserId = userId ? parseInt(userId) : undefined;
    const isAdmin = req.user.permissions?.includes('api_keys:manage') || 
                   req.user.roles?.includes('SUPER_ADMIN');
    
    return this.apiKeysService.findAll(
      isAdmin ? filterUserId : req.user.id
    );
  }

  @Get(':id')
  @RequirePermissions('api_keys:view')
  @ApiOperation({ 
    summary: 'Detalji API ključa',
    description: 'Vraća detaljne informacije o API ključu'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detalji API ključa',
    type: ApiKeyResponseDto
  })
  @ApiResponse({ status: 404, description: 'API ključ nije pronađen' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('api_keys:update')
  @ApiOperation({ 
    summary: 'Ažuriranje API ključa',
    description: 'Ažurira postojeći API ključ (ne menja sam ključ, već metadata)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API ključ uspešno ažuriran',
    type: ApiKeyResponseDto
  })
  @ApiResponse({ status: 404, description: 'API ključ nije pronađen' })
  @ApiResponse({ status: 400, description: 'Ne može se ažurirati revokovan ključ' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @Request() req,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.update(id, updateApiKeyDto, req.user.id);
  }

  @Post(':id/revoke')
  @RequirePermissions('api_keys:revoke')
  @ApiOperation({ 
    summary: 'Revokovanje API ključa',
    description: 'Trajno onemogućava API ključ sa opcionim razlogom'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API ključ uspešno revokovan',
    type: ApiKeyResponseDto
  })
  @ApiResponse({ status: 404, description: 'API ključ nije pronađen' })
  @ApiResponse({ status: 400, description: 'Ključ je već revokovan' })
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() revokeDto: RevokeApiKeyDto,
    @Request() req,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.revoke(id, revokeDto, req.user.id);
  }

  @Get(':id/audit-log')
  @RequirePermissions('api_keys:view')
  @ApiOperation({ 
    summary: 'Audit log API ključa',
    description: 'Vraća istoriju korišćenja i aktivnosti API ključa'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Audit log API ključa',
    type: [ApiKeyLogResponseDto]
  })
  @ApiResponse({ status: 404, description: 'API ključ nije pronađen' })
  async getAuditLog(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ): Promise<ApiKeyLogResponseDto[]> {
    const limitNumber = limit ? parseInt(limit) : 100;
    return this.apiKeysService.getAuditLog(id, limitNumber);
  }

  @Delete(':id')
  @RequirePermissions('api_keys:revoke')
  @ApiOperation({ 
    summary: 'Briše API ključ (ADMIN ONLY)',
    description: 'POTPUNO briše API ključ iz baze. Koristi revoke umesto brisanja!'
  })
  @ApiResponse({ status: 200, description: 'API ključ obrisan' })
  @ApiResponse({ status: 404, description: 'API ključ nije pronađen' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    // TODO: Implementirati brisanje (opciono - obično se koristi revoke)
    return { message: 'Brisanje API ključa nije implementirano. Koristite revoke.' };
  }
}