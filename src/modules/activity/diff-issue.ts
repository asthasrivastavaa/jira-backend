import type { FieldChange } from './schemas/activity.schema.js';

/** The shape of a POPULATED issue (lean), as far as the diff cares. */
export interface IssueSnapshot {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  storyPoints?: number | null;
  dueDate?: Date | string | null;
  assigneeId?: { _id: unknown; name: string } | null;
  labelIds?: { _id: unknown; name: string }[];
  sprintId?: { _id: unknown; name: string } | null;
  parentId?: { _id: unknown; key: string } | null;
}

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const id = (v: { _id: unknown } | null | undefined) => (v ? String(v._id) : null);

/**
 * Field-level diff between the issue before and after an update.
 * Each field says how to compare (`same`) and what to store (`show`). Pure function: easy to unit test (5.5).
 */
const FIELDS: { field: string; same: (a: IssueSnapshot, b: IssueSnapshot) => boolean; show: (s: IssueSnapshot) => unknown }[] = [
  { field: 'title', same: (a, b) => a.title === b.title, show: (s) => s.title },
  // descriptions can be long: record THAT it changed, not both full texts
  { field: 'description', same: (a, b) => (a.description ?? '') === (b.description ?? ''), show: () => null },
  { field: 'status', same: (a, b) => a.status === b.status, show: (s) => s.status },
  { field: 'priority', same: (a, b) => a.priority === b.priority, show: (s) => s.priority },
  { field: 'type', same: (a, b) => a.type === b.type, show: (s) => s.type },
  { field: 'storyPoints', same: (a, b) => (a.storyPoints ?? null) === (b.storyPoints ?? null), show: (s) => s.storyPoints ?? null },
  { field: 'dueDate', same: (a, b) => day(a.dueDate) === day(b.dueDate), show: (s) => day(s.dueDate) },
  { field: 'assignee', same: (a, b) => id(a.assigneeId) === id(b.assigneeId), show: (s) => s.assigneeId?.name ?? null },
  {
    field: 'labels',
    same: (a, b) =>
      (a.labelIds ?? []).map((l) => String(l._id)).sort().join() === (b.labelIds ?? []).map((l) => String(l._id)).sort().join(),
    show: (s) => (s.labelIds ?? []).map((l) => l.name),
  },
  { field: 'sprint', same: (a, b) => id(a.sprintId) === id(b.sprintId), show: (s) => s.sprintId?.name ?? null },
  { field: 'parent', same: (a, b) => id(a.parentId) === id(b.parentId), show: (s) => s.parentId?.key ?? null },
];

export function diffIssue(before: IssueSnapshot, after: IssueSnapshot): FieldChange[] {
  return FIELDS.filter((f) => !f.same(before, after)).map((f) => ({ field: f.field, from: f.show(before), to: f.show(after) }));
}
