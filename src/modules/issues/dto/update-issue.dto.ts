import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueDto } from './create-issue.dto.js';

export class UpdateIssueDto extends PartialType(CreateIssueDto) {}
