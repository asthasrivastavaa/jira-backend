import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { CASE_INSENSITIVE, LABEL_COLORS, Label, LabelDocument } from './schemas/label.schema.js';
import { CreateLabelDto } from './dto/create-label.dto.js';
import { UpdateLabelDto } from './dto/update-label.dto.js';

@Injectable()
export class LabelsService implements OnModuleInit {
  private readonly logger = new Logger(LabelsService.name);

  constructor(
    @InjectModel(Label.name) private labelModel: Model<LabelDocument>,
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
  ) {}

  list(projectId: string) {
    return this.labelModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ name: 1 })
      .collation(CASE_INSENSITIVE)
      .lean()
      .exec();
  }

  async create(projectId: string, dto: CreateLabelDto) {
    try {
      return await this.labelModel.create({ ...dto, projectId: new Types.ObjectId(projectId) });
    } catch (err) {
      throw this.asConflict(err);
    }
  }

  async update(projectId: string, labelId: string, dto: UpdateLabelDto) {
    try {
      const label = await this.labelModel
        .findOneAndUpdate({ _id: labelId, projectId: new Types.ObjectId(projectId) }, dto, {
          new: true,
          runValidators: true,
        })
        .exec();
      if (!label) throw new NotFoundException('Label not found');
      return label;
    } catch (err) {
      throw this.asConflict(err);
    }
  }

  async remove(projectId: string, labelId: string) {
    const label = await this.labelModel
      .findOneAndDelete({ _id: labelId, projectId: new Types.ObjectId(projectId) })
      .exec();
    if (!label) throw new NotFoundException('Label not found');
    await this.issueModel.updateMany({ labelIds: label._id }, { $pull: { labelIds: label._id } }).exec();
  }

  /** Called by IssuesService: every id must be a label of THIS project. */
  async assertInProject(projectId: Types.ObjectId, labelIds: string[]) {
    const unique = [...new Set(labelIds)];
    const found = await this.labelModel.countDocuments({ _id: { $in: unique }, projectId }).exec();
    if (found !== unique.length) throw new BadRequestException('One or more labels do not belong to this project');
  }

  private asConflict(err: unknown) {
    return (err as { code?: number })?.code === 11000
      ? new ConflictException('A label with this name already exists in this project')
      : err;
  }

  /** One-time migration: Phase 1 string labels -> label documents + labelIds. */
  async onModuleInit() {
    const raw = this.issueModel.collection;
    const legacy = await raw
      .find({ labels: { $exists: true } }, { projection: { projectId: 1, labels: 1 } })
      .toArray();
    if (legacy.length === 0) return;

    for (const issue of legacy) {
      const names: string[] = Array.isArray(issue.labels) ? issue.labels : [];
      const labelIds: Types.ObjectId[] = [];
      for (const name of names) {
        const label = await this.labelModel
          .findOneAndUpdate(
            { projectId: issue.projectId, name },
            { $setOnInsert: { color: LABEL_COLORS[name.length % LABEL_COLORS.length] } },
            { upsert: true, new: true, collation: CASE_INSENSITIVE },
          )
          .exec();
        labelIds.push(label._id);
      }
      await raw.updateOne({ _id: issue._id }, { $set: { labelIds }, $unset: { labels: '' } });
    }
    this.logger.log(`Migrated string labels on ${legacy.length} issues`);
  }
}
