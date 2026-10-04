import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
        private workspaces: WorkspacesService,

  ) {}

  private async assertMember(workspaceId: string, userId: string) {
    const membership = await this.workspaces.getMembership(workspaceId, userId);
    if (!membership) throw new NotFoundException('Workspace not found');
  }

  async create(workspaceId: string, userId: string, dto: CreateProjectDto): Promise<ProjectDocument> {
    await this.assertMember(workspaceId, userId);
    try {
      return await this.projectModel.create({ ...dto, workspaceId: new Types.ObjectId(workspaceId) });
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException(`Project key "${dto.key.toUpperCase()}" already exists in this workspace`);
      }
      throw err;
    }
  }

  async findAll(workspaceId: string, userId: string): Promise<ProjectDocument[]> {
    await this.assertMember(workspaceId, userId);
    return this.projectModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByKey(workspaceId: string, key: string, userId: string): Promise<ProjectDocument> {
    await this.assertMember(workspaceId, userId);
    const project = await this.projectModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), key: key.toUpperCase() })
      .exec();
    if (!project) throw new NotFoundException(`Project ${key} not found`);
    return project;
  }


  async findOne(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id).exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectDocument> {
    const existing = await this.projectModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.leadId !== undefined) {
      if (dto.leadId === null) {
        patch.leadId = null;
      } else {
        // the lead must belong to the same workspace as the project
        const member = await this.workspaces.getMembership(String(existing.workspaceId), dto.leadId);
        if (!member) throw new BadRequestException('The project lead must be a member of this workspace');
        patch.leadId = new Types.ObjectId(dto.leadId);
      }
    }

    const project = await this.projectModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async remove(id: string): Promise<void> {
    const result = await this.projectModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    await this.issueModel.deleteMany({ projectId: result._id }).exec();
  }
    async reserveIssueNumber(id: string): Promise<{ projectKey: string; number: number }> {
    const project = await this.projectModel
      .findByIdAndUpdate(id, { $inc: { issueCounter: 1 } }, { new: true })
      .exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return { projectKey: project.key, number: project.issueCounter };
  }

}
