import { Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

export async function globalSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 1) {
      return sendError(res, 'INVALID_QUERY', '请输入搜索关键词', 400);
    }

    const keyword = String(q).trim();
    const userId = req.userId!;

    const [projects, tasks, documents] = await Promise.all([
      prisma.project.findMany({
        where: {
          ownerId: userId,
          OR: [
            { name: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
        select: { id: true, name: true, description: true, status: true },
        take: 10,
      }),
      prisma.task.findMany({
        where: {
          project: { ownerId: userId },
          OR: [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
        select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
        take: 10,
      }),
      prisma.document.findMany({
        where: {
          project: { ownerId: userId },
          OR: [
            { title: { contains: keyword } },
            { content: { contains: keyword } },
          ],
        },
        select: { id: true, title: true, type: true, projectId: true, project: { select: { name: true } } },
        take: 10,
      }),
    ]);

    sendSuccess(res, {
      projects: projects.map(p => ({ ...p, type: 'project' as const })),
      tasks: tasks.map(t => ({ ...t, type: 'task' as const })),
      documents: documents.map(d => ({ ...d, type: 'document' as const })),
      total: projects.length + tasks.length + documents.length,
    });
  } catch (err) {
    next(err);
  }
}
