import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';
import { SprintsService } from './sprints.service.js';
import { CompleteSprintDto, CreateSprintDto, StartSprintDto, UpdateSprintDto } from './dto/sprint.dto.js';

// Nested under the project (default guard scope = :projectId). Viewers read; members+ plan and run sprints,
// the same level as editing issues, since planning a sprint is moving issues around.
@Controller('projects/:projectId')
@UseGuards(ProjectMemberGuard)
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('backlog')
  backlog(@Param('projectId', ParseObjectIdPipe) projectId: string) {
    return this.sprints.backlog(projectId);
  }

  @Get('sprints')
  list(@Param('projectId', ParseObjectIdPipe) projectId: string) {
    return this.sprints.list(projectId);
  }

  @Post('sprints')
  @Roles('member')
  create(@Param('projectId', ParseObjectIdPipe) projectId: string, @Body() dto: CreateSprintDto) {
    return this.sprints.create(projectId, dto);
  }

  @Patch('sprints/:sprintId')
  @Roles('member')
  update(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('sprintId', ParseObjectIdPipe) sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprints.update(projectId, sprintId, dto);
  }

  @Post('sprints/:sprintId/start')
  @HttpCode(200)
  @Roles('member')
  start(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('sprintId', ParseObjectIdPipe) sprintId: string,
    @Body() dto: StartSprintDto,
  ) {
    return this.sprints.start(projectId, sprintId, dto);
  }

  @Post('sprints/:sprintId/complete')
  @HttpCode(200)
  @Roles('member')
  complete(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('sprintId', ParseObjectIdPipe) sprintId: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sprints.complete(projectId, sprintId, dto, user.id);
  }

  @Delete('sprints/:sprintId')
  @Roles('member')
  remove(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('sprintId', ParseObjectIdPipe) sprintId: string,
  ) {
    return this.sprints.remove(projectId, sprintId);
  }
}
