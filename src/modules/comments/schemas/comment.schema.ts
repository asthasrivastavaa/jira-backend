import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Issue', required: true })
  issueId: Types.ObjectId;

  // denormalized from the issue: deleting a project can remove its comments in one deleteMany
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  /** HTML from the rich-text editor, ALREADY SANITIZED on the way in. */
  @Prop({ required: true })
  body: string;

  /** set when the author edits; the UI shows an "edited" tag */
  @Prop({ type: Date, default: null })
  editedAt: Date | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
// "the newest N comments of an issue, older than <cursor>": issueId equality + _id range, served by one index
CommentSchema.index({ issueId: 1, _id: -1 });
