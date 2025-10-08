import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CentralPointsService } from './central-points.service';
import { CreateCentralPointDto } from './dto/create-central-point.dto';
import { UpdateCentralPointDto } from './dto/update-central-point.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Central Points')
@Controller('central-points')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CentralPointsController {
  constructor(private readonly centralPointsService: CentralPointsService) {}

  // ========== GLAVNI SERVER ENDPOINTS ==========

  @Post()
  @ApiOperation({ summary: 'Kreiranje nove centralne tačke (Glavni server)' })
  @ApiResponse({ status: 201, description: 'Centralna tačka uspešno kreirana' })
  @RequirePermissions('transport.administration.central_points:create')
  create(@Body() createCentralPointDto: CreateCentralPointDto) {
    return this.centralPointsService.create(createCentralPointDto);
  }

  @Get('main')
  @ApiOperation({ summary: 'Sve centralne tačke sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Lista centralnih tačaka' })
  @RequirePermissions('transport.administration.central_points:view')
  findAllMain() {
    return this.centralPointsService.findAllMain();
  }

  @Get('main/:id')
  @ApiOperation({ summary: 'Jedna centralna tačka sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Detalji centralne tačke' })
  @ApiResponse({ status: 404, description: 'Centralna tačka nije pronađena' })
  @RequirePermissions('transport.administration.central_points:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.centralPointsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje centralne tačke (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Centralna tačka uspešno ažurirana' })
  @ApiResponse({ status: 404, description: 'Centralna tačka nije pronađena' })
  @RequirePermissions('transport.administration.central_points:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCentralPointDto: UpdateCentralPointDto,
  ) {
    return this.centralPointsService.update(id, updateCentralPointDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje centralne tačke (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Centralna tačka uspešno obrisana' })
  @ApiResponse({ status: 404, description: 'Centralna tačka nije pronađena' })
  @RequirePermissions('transport.administration.central_points:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.centralPointsService.remove(id);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing')
  @ApiOperation({ summary: 'Sve centralne tačke sa Tiketing servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista centralnih tačaka' })
  @RequirePermissions('transport.administration.central_points.ticketing:view')
  findAllTicketing() {
    return this.centralPointsService.findAllTicketing();
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city')
  @ApiOperation({ summary: 'Sve centralne tačke sa Gradskog servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista centralnih tačaka' })
  @RequirePermissions('transport.administration.central_points.city:view')
  findAllCity() {
    return this.centralPointsService.findAllCity();
  }
}
