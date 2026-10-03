
import { IssuesService } from './issues.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto.js';

@Controller()
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('projects/:projectId/issues')
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
  @Get('issues/key/:key')
  findByKey(@Param('key') key: string) {
    return this.issuesService.findByKey(key);
  }

  @Get('issues/:id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch('issues/:id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto);
  }

  @Delete('issues/:id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.issuesService.remove(id);
    return { id };
  }
}
