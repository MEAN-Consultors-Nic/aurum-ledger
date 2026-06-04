import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import { CreateDeliverableDto, UpdateDeliverableDto } from './dto/deliverable.dto';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  ChecklistItemDto,
  CreateTaskDto,
  MoveTaskDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { GithubLinkDto } from './dto/github-link.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectCredentialsService } from './project-credentials.service';
import { ProjectHandoverService } from './project-handover.service';
import { ProjectTasksService } from './project-tasks.service';
import { ProjectsService } from './projects.service';
import { PROJECT_TEMPLATES } from './templates';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: ProjectTasksService,
    private readonly credentialsService: ProjectCredentialsService,
    private readonly handoverService: ProjectHandoverService,
  ) {}

  @Get('templates')
  templates() {
    return PROJECT_TEMPLATES.map((t) => ({
      key: t.key,
      label: t.label,
      taskCount: t.tasks.length,
      deliverableCount: t.deliverables.length,
      suggestedCredentials: t.suggestedCredentials,
    }));
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
  ) {
    return this.projectsService.list({ status, clientId, search });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.projectsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestUser) {
    return this.projectsService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.update(id, dto, user?._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.remove(id, user?._id);
  }

  @Post(':id/apply-template/:templateKey')
  applyTemplate(
    @Param('id') id: string,
    @Param('templateKey') templateKey: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.applyTemplate(id, templateKey, user?._id);
  }

  // ----- Notes -----
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.addNote(id, dto, user?._id);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.updateNote(id, noteId, dto, user?._id);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.deleteNote(id, noteId, user?._id);
  }

  // ----- Deliverables -----
  @Post(':id/deliverables')
  addDeliverable(
    @Param('id') id: string,
    @Body() dto: CreateDeliverableDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.addDeliverable(id, dto, user?._id);
  }

  @Patch(':id/deliverables/:deliverableId')
  updateDeliverable(
    @Param('id') id: string,
    @Param('deliverableId') deliverableId: string,
    @Body() dto: UpdateDeliverableDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.updateDeliverable(id, deliverableId, dto, user?._id);
  }

  @Delete(':id/deliverables/:deliverableId')
  deleteDeliverable(
    @Param('id') id: string,
    @Param('deliverableId') deliverableId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.deleteDeliverable(id, deliverableId, user?._id);
  }

  // ----- Tasks -----
  @Get(':id/tasks')
  listTasks(@Param('id') id: string) {
    return this.tasksService.list(id);
  }

  @Post(':id/tasks')
  createTask(
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.create(id, dto, user?._id);
  }

  @Patch(':id/tasks/:taskId')
  updateTask(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.update(taskId, dto, user?._id);
  }

  @Delete(':id/tasks/:taskId')
  deleteTask(@Param('taskId') taskId: string, @CurrentUser() user: RequestUser) {
    return this.tasksService.remove(taskId, user?._id);
  }

  @Patch(':id/tasks/:taskId/move')
  moveTask(
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.move(taskId, dto, user?._id);
  }

  // ----- Task checklist -----
  @Post(':id/tasks/:taskId/checklist')
  addChecklistItem(
    @Param('taskId') taskId: string,
    @Body() dto: ChecklistItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.addChecklistItem(taskId, dto, user?._id);
  }

  @Patch(':id/tasks/:taskId/checklist/:itemId')
  updateChecklistItem(
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.updateChecklistItem(taskId, itemId, dto, user?._id);
  }

  @Delete(':id/tasks/:taskId/checklist/:itemId')
  removeChecklistItem(
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.removeChecklistItem(taskId, itemId, user?._id);
  }

  // ----- Credentials -----
  @Get(':id/credentials')
  listCredentials(@Param('id') id: string) {
    return this.credentialsService.list(id);
  }

  @Post(':id/credentials')
  createCredential(
    @Param('id') id: string,
    @Body() dto: CreateCredentialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.credentialsService.create(id, dto, user?._id);
  }

  @Patch(':id/credentials/:credentialId')
  updateCredential(
    @Param('credentialId') credentialId: string,
    @Body() dto: UpdateCredentialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.credentialsService.update(credentialId, dto, user?._id);
  }

  @Delete(':id/credentials/:credentialId')
  deleteCredential(
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.credentialsService.remove(credentialId, user?._id);
  }

  // ----- Client-portal share link -----
  @Post(':id/share')
  generateShare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.generateShareToken(id, user?._id);
  }

  @Delete(':id/share')
  revokeShare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.revokeShareToken(id, user?._id);
  }

  // ----- GitHub repo link -----
  @Post(':id/github/link')
  linkGithub(
    @Param('id') id: string,
    @Body() dto: GithubLinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.linkGithubRepo(id, dto.repoUrl, user?._id);
  }

  @Delete(':id/github/link')
  unlinkGithub(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.unlinkGithubRepo(id, user?._id);
  }

  @Get(':id/github/activity')
  githubActivity(@Param('id') id: string) {
    return this.projectsService.getGithubActivity(id);
  }

  // ----- Handover PDF -----
  @Get(':id/handover.pdf')
  @Header('Content-Type', 'application/pdf')
  async handoverPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.handoverService.generate(id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}
