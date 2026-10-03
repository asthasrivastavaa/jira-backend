import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto.js';

import { Issue, IssueDocument } from './schemas/issue.schema.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { ProjectsService } from '../projects/projects.service.js';

@Injectable()
export class IssuesService {
  constructor(
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    private projectsService: ProjectsService,
  ) {}

  async create(projectId: string, dto: CreateIssueDto): Promise<IssueDocument> {
    const { projectKey, number } = await this.projectsService.reserveIssueNumber(projectId);
    return this.issueModel.create({
      ...dto,
      projectId: new Types.ObjectId(projectId),
      number,
      key: `${projectKey}-${number}`,
    });
  }
  async findAllByProject(projectId: string, query: ListIssuesQueryDto) {
    await this.projectsService.findOne(projectId);

    const filter: QueryFilter<IssueDocument> = { projectId: new Types.ObjectId(projectId) };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.priority) filter.priority = query.priority;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const sort = query.sort ?? '-number';
    const sortSpec: Record<string, 1 | -1> = {
      [sort.replace('-', '')]: sort.startsWith('-') ? -1 : 1,
    };

    const [items, total] = await Promise.all([
      this.issueModel
        .find(filter)
        .sort(sortSpec)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.issueModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }


  async findOne(id: string): Promise<IssueDocument> {
    const issue = await this.issueModel.findById(id).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  async update(id: string, dto: UpdateIssueDto): Promise<IssueDocument> {
    const issue = await this.issueModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }
    async findByKey(key: string): Promise<IssueDocument> {
    const issue = await this.issueModel.findOne({ key: key.toUpperCase() }).exec();
    if (!issue) throw new NotFoundException(`Issue ${key} not found`);
    return issue;
  }


  async remove(id: string): Promise<void> {
    const result = await this.issueModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Issue ${id} not found`);
  }
}
