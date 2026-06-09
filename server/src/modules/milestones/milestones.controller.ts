import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const createMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
});

const updateMilestoneSchema = createMilestoneSchema.partial();

export async function getMilestones(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const milestones = await prisma.milestone.findMany({
      where: { projectId: pid },
      orderBy: { dueDate: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });
    sendSuccess(res, milestones);
  } catch (err) { next(err); }
}

export async function createMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const data = createMilestoneSchema.parse(req.body);
    const milestone = await prisma.milestone.create({
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined, projectId: pid },
    });
    sendSuccess(res, milestone, 201);
  } catch (err) { next(err); }
}

export async function updateMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!milestone) return sendError(res, 'NOT_FOUND', '里程碑不存在', 404);

    const data = updateMilestoneSchema.parse(req.body);
    const updated = await prisma.milestone.update({
      where: { id: milestone.id },
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
}

export async function deleteMilestone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!milestone) return sendError(res, 'NOT_FOUND', '里程碑不存在', 404);

    await prisma.milestone.delete({ where: { id: milestone.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}
