import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { WorkspaceRoleGuard } from '../../common/gaurds/workspace-role.gaurd.js';
import { SearchService } from './search.service.js';

class SearchQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;
}

// Any member (viewers too) may search; results only ever come from this workspace's projects.
@Controller('workspaces/:workspaceId/search')
@UseGuards(WorkspaceRoleGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Param('workspaceId', ParseObjectIdPipe) workspaceId: string, @Query() query: SearchQueryDto) {
    return this.searchService.search(workspaceId, query.q);
  }
}
