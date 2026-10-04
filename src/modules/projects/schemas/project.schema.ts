import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true })
export class Project {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true })
   workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true,  uppercase: true, trim: true })
  key: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: 0 })
  issueCounter: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  leadId?: Types.ObjectId | null;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
