import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto.js';

// The project KEY is deliberately absent: issue keys (PROJ-12) are built from it, so it can never change.
// Sending "key" in a PATCH is rejected with a 400 by the global ValidationPipe (forbidNonWhitelisted).
export class UpdateProjectDto extends PartialType(OmitType(CreateProjectDto, ['key'] as const)) {
  // null clears the lead; a value must be a member of the workspace (checked in the service)
  @IsOptional()
  @IsMongoId()
  leadId?: string | null;
}
