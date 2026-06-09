import { Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

export async function getTimeline(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { limit = '50', offset = '0', projectId } = req.query;

    const where: any = { project: { ownerId: req.userId } };
    if (projectId) where.projectId = String(projectId);

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
      skip: parseInt(String(offset)),
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    const total = await prisma.activityLog.count({ where });

    sendSuccess(res, logs, 200, {
      page: Math.floor(parseInt(String(offset)) / parseInt(String(limit))) + 1,
      pageSize: parseInt(String(limit)),
      total,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProjectTimeline(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const logs = await prisma.activityLog.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
      skip: parseInt(String(offset)),
    });

    const total = await prisma.activityLog.count({ where: { projectId: pid } });

    sendSuccess(res, logs, 200, {
      page: Math.floor(parseInt(String(offset)) / parseInt(String(limit))) + 1,
      pageSize: parseInt(String(limit)),
      total,
    });
  } catch (err) {
    next(err);
  }
}
