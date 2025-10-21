import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { SearchDto } from './dto/search.dto';
import { AssignExecutorDto } from './dto/assign-executor.dto';
import { CreateComplaintPriorityDto } from './dto/create-complaint-priority.dto';
import { UpdateComplaintPriorityDto } from './dto/update-complaint-priority.dto';
import { CreateStatusHistoryDto } from './dto/create-status-history.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve aktivne reklamacije' })
  @ApiResponse({ status: 200, description: 'Lista reklamacija' })
  @RequirePermissions('complaints:view')
  getData() {
    return this.service.getData();
  }

  @Get('inactive')
  @ApiOperation({ summary: 'Dohvati sve neaktivne reklamacije' })
  @ApiResponse({ status: 200, description: 'Lista reklamacija' })
  @RequirePermissions('complaints:view')
  getInactiveData() {
    return this.service.getInactiveData();
  }

  @Post('types/search')
  @ApiOperation({ summary: 'Pretraži tipove reklamacija' })
  @ApiResponse({ status: 200, description: 'Lista tipova' })
  @RequirePermissions('complaints:view')
  searchTypes(@Body() searchDto: SearchDto) {
    return this.service.searchTypes(searchDto, 10);
  }

  @Post('priorities/search')
  @ApiOperation({ summary: 'Pretraži prioritete reklamacija' })
  @ApiResponse({ status: 200, description: 'Lista prioriteta' })
  @RequirePermissions('complaints:view')
  searchPriorities(@Body() searchDto: SearchDto) {
    return this.service.searchPriorities(searchDto, 10);
  }

  @Post('categories/search')
  @ApiOperation({ summary: 'Pretraži kategorije reklamacija' })
  @ApiResponse({ status: 200, description: 'Lista kategorija' })
  @RequirePermissions('complaints:view')
  searchCategories(@Body() searchDto: SearchDto) {
    return this.service.searchCategories(searchDto, 10);
  }

  @Post('statuses/search')
  @ApiOperation({ summary: 'Pretraži statuse reklamacija' })
  @ApiResponse({ status: 200, description: 'Lista statusa' })
  @RequirePermissions('complaints:view')
  searchStatuses(@Body() searchDto: SearchDto) {
    return this.service.searchStatuses(searchDto, 10);
  }

  @Get(':id/korisnik')
  @ApiOperation({ summary: 'Dohvati korisnika za reklamaciju' })
  @ApiResponse({ status: 200, description: 'Podaci o korisniku' })
  @RequirePermissions('complaints:view')
  getKorisnikById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getKorisnikById(id);
  }

  @Get(':id/executor')
  @ApiOperation({ summary: 'Dohvati izvršioca za reklamaciju' })
  @ApiResponse({ status: 200, description: 'ID izvršioca' })
  @RequirePermissions('complaints:view')
  getExecutorForComplaint(@Param('id', ParseIntPipe) id: number) {
    return this.service.getExecutorForComplaint(id);
  }

  @Post('assign-executor')
  @ApiOperation({ summary: 'Dodeli izvršioca reklamaciji' })
  @ApiResponse({ status: 200, description: 'Izvršilac dodeljen' })
  @RequirePermissions('complaints:update')
  assignExecutor(@Body() assignDto: AssignExecutorDto) {
    return this.service.assignExecutor(assignDto);
  }

  // ==================== COMPLAINTS BY ASSIGNEE ====================

  @Get('by-assignee')
  @ApiOperation({ summary: 'Dohvati reklamacije dodeljene trenutnom korisniku' })
  @ApiResponse({ status: 200, description: 'Lista reklamacija' })
  @RequirePermissions('complaints_by_assignee:view')
  getComplaintsByAssignee(@CurrentUser() user: any) {
    return this.service.getComplaintsByAssignee(user.id);
  }

  @Post('status-history')
  @ApiOperation({ summary: 'Kreiraj novi unos u istoriju statusa' })
  @ApiResponse({ status: 201, description: 'Status istorija kreirana' })
  @RequirePermissions('complaints_by_assignee:update')
  createStatusHistory(@Body() dto: CreateStatusHistoryDto, @CurrentUser() user: any) {
    return this.service.createStatusHistory(dto, user.id);
  }

  @Post('status-history/search')
  @ApiOperation({ summary: 'Pretraži istoriju statusa za reklamaciju' })
  @ApiResponse({ status: 200, description: 'Istorija statusa' })
  @RequirePermissions('complaints_by_assignee:view')
  searchStatusHistory(@Body() body: { reklamacija_id: number }) {
    return this.service.getStatusComplaintHistory(body.reklamacija_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati reklamaciju po ID-u' })
  @ApiResponse({ status: 200, description: 'Reklamacija' })
  @ApiResponse({ status: 404, description: 'Reklamacija nije pronađena' })
  @RequirePermissions('complaints:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Dohvati istoriju statusa za reklamaciju' })
  @ApiResponse({ status: 200, description: 'Istorija statusa' })
  @RequirePermissions('complaints_by_assignee:view')
  getStatusComplaintHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStatusComplaintHistory(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novu reklamaciju' })
  @ApiResponse({ status: 201, description: 'Reklamacija kreirana' })
  @RequirePermissions('complaints:create')
  create(@Body() createDto: CreateComplaintDto, @CurrentUser() user: any) {
    return this.service.create(createDto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj reklamaciju' })
  @ApiResponse({ status: 200, description: 'Reklamacija ažurirana' })
  @ApiResponse({ status: 404, description: 'Reklamacija nije pronađena' })
  @RequirePermissions('complaints:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateComplaintDto, @CurrentUser() user: any) {
    return this.service.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši reklamaciju' })
  @ApiResponse({ status: 200, description: 'Reklamacija obrisana' })
  @ApiResponse({ status: 404, description: 'Reklamacija nije pronađena' })
  @RequirePermissions('complaints:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // ==================== COMPLAINT PRIORITIES ====================

  @Get('priorities/all')
  @ApiOperation({ summary: 'Dohvati sve prioritete reklamacija' })
  @ApiResponse({ status: 200, description: 'Lista prioriteta' })
  @RequirePermissions('complaints:view')
  getAllPriorities() {
    return this.service.getAllPriorities();
  }

  @Post('priorities')
  @ApiOperation({ summary: 'Kreiraj novi prioritet' })
  @ApiResponse({ status: 201, description: 'Prioritet kreiran' })
  @RequirePermissions('complaints:create')
  createPriority(@Body() dto: CreateComplaintPriorityDto) {
    return this.service.createPriority(dto);
  }

  @Patch('priorities/:id')
  @ApiOperation({ summary: 'Ažuriraj prioritet' })
  @ApiResponse({ status: 200, description: 'Prioritet ažuriran' })
  @ApiResponse({ status: 404, description: 'Prioritet nije pronađen' })
  @RequirePermissions('complaints:update')
  updatePriority(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateComplaintPriorityDto) {
    return this.service.updatePriority(id, dto);
  }

  @Delete('priorities/:id')
  @ApiOperation({ summary: 'Obriši prioritet' })
  @ApiResponse({ status: 200, description: 'Prioritet obrisan' })
  @ApiResponse({ status: 404, description: 'Prioritet nije pronađen' })
  @RequirePermissions('complaints:delete')
  deletePriority(@Param('id', ParseIntPipe) id: number) {
    return this.service.deletePriority(id);
  }
}
