import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceDto } from './create-workspace.dto.js';

// same rules as creating (name length, slug format, reserved words); every field optional
export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {}
