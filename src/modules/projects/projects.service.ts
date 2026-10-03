import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
  ) {}

  async create(dto: CreateProjectDto): Promise<ProjectDocument> {
    try {
      return await this.projectModel.create(dto);
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException(`Project key "${dto.key}" already exists`);
      }
      throw err;
    }
  }

async findByKey(key: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findOne({ key: key.toUpperCase() }).exec();
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    return project;
  }


  async findAll(): Promise<ProjectDocument[]> {
    return this.projectModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id).exec();
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectDocument> {
    const project = await this.projectModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
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
