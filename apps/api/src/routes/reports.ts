import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/client';
import { sendNotification } from '../services/notification.service';
import {
  ReportTask,
  EnrichedTask,
  filterByDateRange,
  completionRate,
  bucketBy,
  buildCsvRows,
} from './reports.csv';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

function enrichAssignees(tasks: ReportTask[]): EnrichedTask[] {
  return tasks.map((t) => {
    let assigneeName = 'unassigned';
    if (t.assigneeId !== null) {
      const u = db.find('users', (r) => r.id === t.assigneeId) as
        | { name: string }
        | undefined;
      if (u) assigneeName = u.name;
    }
    return { ...t, assigneeName };
  });
}

reportsRouter.get('/project/:projectId.csv', async (req, res) => {
  const projectId = Number(req.params.projectId);
  const tz = (req.query.tz as string) || 'UTC';
  const includeArchived = req.query.includeArchived === 'true';
  const groupBy = (req.query.groupBy as string) || 'status';
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const project = db.find('projects', (r) => r.id === projectId) as
    | { id: number; name: string; workspaceId: number; archived: boolean }
    | undefined;
  if (!project) {
    res.status(404).json({ error: 'project not found' });
    return;
  }
  if (project.archived && !includeArchived) {
    res.status(404).json({ error: 'project archived' });
    return;
  }

  const allTasks = db.list('tasks', (r) => r.projectId === projectId) as unknown as ReportTask[];
  const tasks = filterByDateRange(allTasks, startDate, endDate);
  const enriched = enrichAssignees(tasks);
  const total = enriched.length;
  const rate = completionRate(enriched);
  const buckets = bucketBy(enriched, groupBy);
  const rows = buildCsvRows(project, buckets, {
    completionRate: rate,
    total,
    generatedAt: new Date().toISOString(),
    tz,
  });

  sendNotification({
    to: 'reports@orbittasks.local',
    subject: `Report generated for ${project.name}`,
    body: `${total} tasks, ${rate}% complete`,
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${project.name.replace(/\s+/g, '_')}.csv"`,
  );
  res.send(rows.join('\n'));
});