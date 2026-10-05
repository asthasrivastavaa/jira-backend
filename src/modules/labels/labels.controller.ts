import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';
import { LabelsService } from './labels.service.js';
import { CreateLabelDto } from './dto/create-label.dto.js';
import { UpdateLabelDto } from './dto/update-label.dto.js';

@Controller('projects/:projectId/labels')
@UseGuards(ProjectMemberGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  list(@Param('projectId', ParseObjectIdPipe) projectId: string) {
    return this.labels.list(projectId);
  }

  @Post()
  @Roles('member')
  create(@Param('projectId', ParseObjectIdPipe) projectId: string, @Body() dto: CreateLabelDto) {
    return this.labels.create(projectId, dto);
  }

  @Patch(':labelId')
  @Roles('member')
  update(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('labelId', ParseObjectIdPipe) labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.labels.update(projectId, labelId, dto);
  }

  @Delete(':labelId')
  @Roles('member')
  async remove(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Param('labelId', ParseObjectIdPipe) labelId: string,
  ) {
    await this.labels.remove(projectId, labelId);
    return { id: labelId };
  }
}
