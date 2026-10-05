import { PartialType } from '@nestjs/mapped-types';
import { CreateLabelDto } from './create-label.dto.js';

export class UpdateLabelDto extends PartialType(CreateLabelDto) {}
