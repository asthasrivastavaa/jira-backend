import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Scope } from '../../common/decorators/scope.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto.js';
import { ActivityService } from './activity.service.js';

// Read-only: history is written by the server as a side effect of issue changes, never by clients.
@Controller('issues/:issueId/activity')
@UseGuards(ProjectMemberGuard)
@Scope('issue', 'issueId')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Param('issueId', ParseObjectIdPipe) issueId: string, @Query() query: CursorQueryDto) {
    return this.activity.list(issueId, query);
  }
}
