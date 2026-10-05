import type { PopulateOptions } from 'mongoose';

// What gets populated on every issue read, and with which fields. Users: public fields only.
const PUBLIC_USER_FIELDS = 'name email';

export const ISSUE_REFS: PopulateOptions[] = [
  { path: 'assigneeId', select: PUBLIC_USER_FIELDS },
  { path: 'reporterId', select: PUBLIC_USER_FIELDS },
  { path: 'labelIds', select: 'name color' },
  { path: 'sprintId', select: 'name status' },
  { path: 'parentId', select: 'key title type status' },
];
