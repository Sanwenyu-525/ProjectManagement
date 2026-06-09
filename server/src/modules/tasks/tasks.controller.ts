import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().optional(),
  repoScope: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial();

export async function getTasks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const { status, repoScope } = req.query;

    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const where: any = { projectId: pid };
    if (status) where.status = String(status);
    if (repoScope !== undefined) {
      where.repoScope = repoScope === 'null' ? null : String(repoScope);
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        scopedRepo: { select: { id: true, platform: true, repoFullName: true } },
        children: { select: { id: true, title: true, status: true } },
      },
    });
    sendSuccess(res, tasks);
  } catch (err) {
    next(err);
  }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const data = createTaskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        projectId: pid,
      },
    });

    await prisma.activityLog.create({
      data: { action: 'task_created', entityType: 'Task', entityId: task.id, details: JSON.stringify({ title: task.title }), projectId: pid },
    });

    sendSuccess(res, task, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = updateTaskSchema.parse(req.body);
    const task = await prisma.task.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!task) return sendError(res, 'NOT_FOUND', '任务不存在', 404);

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!task) return sendError(res, 'NOT_FOUND', '任务不存在', 404);

    await prisma.task.delete({ where: { id: task.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function updateTaskStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const task = await prisma.task.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!task) return sendError(res, 'NOT_FOUND', '任务不存在', 404);

    const updated = await prisma.task.update({ where: { id: task.id }, data: { status } });

    await prisma.activityLog.create({
      data: { action: 'task_status_change', entityType: 'Task', entityId: task.id, details: JSON.stringify({ from: task.status, to: status }), projectId: task.projectId },
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}
