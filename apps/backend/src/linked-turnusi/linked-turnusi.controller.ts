import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LinkedTurnusiService } from './linked-turnusi.service';
import { CreateLinkedTurnusDto } from './dto/create-linked-turnus.dto';
import { UpdateLinkedTurnusDto } from './dto/update-linked-turnus.dto';
import { QueryLinkedTurnusDto } from './dto/query-linked-turnus.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Linked Turnusi (Povezani turnusi)')
@Controller('linked-turnusi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LinkedTurnusiController {
  constructor(private readonly linkedTurnusiService: LinkedTurnusiService) {}

  @Post()
  @RequirePermissions('transport.planning.linked_turnusi:create')
  @ApiOperation({
    summary: 'Kreiraj novi povezani turnus',
    description: 'Povezuje dva turnusa koji se voze zajedno',
  })
  @ApiResponse({
    status: 201,
    description: 'Povezani turnus uspešno kreiran',
  })
  @ApiResponse({
    status: 400,
    description: 'Loši podaci ili turnus ne može biti povezan sam sa sobom',
  })
  @ApiResponse({
    status: 404,
    description: 'Jedan ili oba turnusa ne postoje',
  })
  @ApiResponse({
    status: 409,
    description: 'Veza između ovih turnusa već postoji',
  })
  create(@Body() dto: CreateLinkedTurnusDto, @Req() req: any) {
    const userId = req.user.id;
    return this.linkedTurnusiService.create(dto, userId);
  }

  @Get()
  @RequirePermissions('transport.planning.linked_turnusi:view')
  @ApiOperation({
    summary: 'Dobavi sve povezane turnuse',
    description: 'Lista svih povezanih turnusa sa opcionalnim filterima',
  })
  @ApiQuery({
    name: 'lineNumber',
    required: false,
    description: 'Filter po broju linije (bilo koje od dve linije)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE'],
    description: 'Filter po statusu',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista povezanih turnusa',
  })
  findAll(@Query() query: QueryLinkedTurnusDto) {
    return this.linkedTurnusiService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('transport.planning.linked_turnusi:view')
  @ApiOperation({
    summary: 'Dobavi jedan povezani turnus po ID-u',
  })
  @ApiParam({
    name: 'id',
    description: 'ID povezanog turnusa',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalji povezanog turnusa',
  })
  @ApiResponse({
    status: 404,
    description: 'Povezani turnus nije pronađen',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.linkedTurnusiService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('transport.planning.linked_turnusi:update')
  @ApiOperation({
    summary: 'Ažuriraj povezani turnus',
  })
  @ApiParam({
    name: 'id',
    description: 'ID povezanog turnusa',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Povezani turnus uspešno ažuriran',
  })
  @ApiResponse({
    status: 404,
    description: 'Povezani turnus nije pronađen',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLinkedTurnusDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.linkedTurnusiService.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('transport.planning.linked_turnusi:delete')
  @ApiOperation({
    summary: 'Obriši povezani turnus',
  })
  @ApiParam({
    name: 'id',
    description: 'ID povezanog turnusa',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Povezani turnus uspešno obrisan',
  })
  @ApiResponse({
    status: 404,
    description: 'Povezani turnus nije pronađen',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.linkedTurnusiService.remove(id);
  }
}
