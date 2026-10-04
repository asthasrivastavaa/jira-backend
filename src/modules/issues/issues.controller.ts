import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IssuesService } from './issues.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Scope } from '../../common/decorators/scope.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';

// Role matrix: viewers read; members, admins and owners create / edit / delete issues.
// ProjectMemberGuard finds the workspace from the project/issue id, so guessing an id gets a 404.
@Controller()
@UseGuards(ProjectMemberGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  // default scope = project from :projectId
  @Post('projects/:projectId/issues')
  @Roles('member')
  create(@Param('projectId', ParseObjectIdPipe) projectId: string, @Body() dto: CreateIssueDto) {
    return this.issuesService.create(projectId, dto);
  }

  @Get('projects/:projectId/issues')
  findAll(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Query() query: ListIssuesQueryDto,
  ) {
    return this.issuesService.findAllByProject(projectId, query);
  }

  @Get('projects/:projectId/issues/key/:key')
  findByKey(@Param('projectId', ParseObjectIdPipe) projectId: string, @Param('key') key: string) {
    return this.issuesService.findByKey(projectId, key);
  }

  @Get('issues/:id')
  @Scope('issue', 'id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch('issues/:id')
  @Scope('issue', 'id')
  @Roles('member')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto);
  }

  @Delete('issues/:id')
  @Scope('issue', 'id')
  @Roles('member')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.issuesService.remove(id);
    return { id };
  }
}
