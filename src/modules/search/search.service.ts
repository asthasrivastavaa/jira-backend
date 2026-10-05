import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Issue, IssueDocument } from '../issues/schemas/issue.schema.js';
import { Project, ProjectDocument } from '../projects/schemas/project.schema.js';

const LIMIT = 10;
const ISSUE_KEY = /^[A-Z][A-Z0-9]*-\d+$/i;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface IssueHit {
  _id: Types.ObjectId;
  key: string;
  title: string;
  type: string;
  status: string;
  projectId: Types.ObjectId;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Issue.name) private issueModel: Model<IssueDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  /**
   * Search issues and projects of ONE workspace (the guard already checked membership).
   * Three tiers for issues, best first, without duplicates:
   *   1. exact key ("TP-12")              -> the user knows exactly what they want
   *   2. $text (whole words, ranked)      -> uses the text index; "login bug" finds "Bug in the login form"
   *   3. title substring (regex)          -> catches partial words while typing ("logi" -> "login")
   * $text vs regex: $text uses an index and ranks by relevance but only matches whole words (stemmed);
   * a case-insensitive "contains" regex matches anything but can't use an index, so it runs last and limited.
   */
  async search(workspaceId: string, rawQuery: string) {
    const q = rawQuery.trim();
    const projects = await this.projectModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .select('name key')
      .lean()
      .exec();
    const projectIds = projects.map((p) => p._id);
    const keyOf = new Map(projects.map((p) => [String(p._id), p.key]));
    const inWorkspace = { projectId: { $in: projectIds } };
    const fields = { key: 1, title: 1, type: 1, status: 1, projectId: 1 };

    const hits: IssueHit[] = [];
    const seen = new Set<string>();
    const add = (rows: IssueHit[]) => {
      for (const row of rows) {
        if (hits.length < LIMIT && !seen.has(String(row._id))) {
          seen.add(String(row._id));
          hits.push(row);
        }
      }
    };

    if (ISSUE_KEY.test(q)) {
      add(await this.issueModel.find({ ...inWorkspace, key: q.toUpperCase() }, fields).lean<IssueHit[]>().exec());
    }

    add(
      await this.issueModel
        .find({ ...inWorkspace, $text: { $search: q } }, { ...fields, score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(LIMIT)
        .lean<IssueHit[]>()
        .exec(),
    );

    const contains = new RegExp(escapeRegex(q), 'i');
    if (hits.length < LIMIT) {
      add(
        await this.issueModel
          .find({ ...inWorkspace, title: contains, _id: { $nin: [...seen].map((id) => new Types.ObjectId(id)) } }, fields)
          .sort({ number: -1 })
          .limit(LIMIT - hits.length)
          .lean<IssueHit[]>()
          .exec(),
      );
    }

    return {
      // projectKey lets the client build the URL /{workspace}/projects/{KEY}/issues/{ISSUE-KEY}
      issues: hits.map(({ _id, key, title, type, status, projectId }) => ({
        _id,
        key,
        title,
        type,
        status,
        projectKey: keyOf.get(String(projectId)),
      })),
      // a workspace has few projects, so filtering them in memory is fine
      projects: projects.filter((p) => contains.test(p.name) || contains.test(p.key)).slice(0, 5),
    };
  }
}
