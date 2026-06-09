import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional(),
});

const updateTagSchema = createTagSchema.partial();

export async function getTags(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, tags);
  } catch (err) { next(err); }
}

export async function createTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createTagSchema.parse(req.body);
    const existing = await prisma.tag.findFirst({ where: { userId: req.userId, name: data.name } });
    if (existing) return sendError(res, 'DUPLICATE', '标签已存在', 409);

    const tag = await prisma.tag.create({ data: { ...data, userId: req.userId! } });
    sendSuccess(res, tag, 201);
  } catch (err) { next(err); }
}

export async function updateTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tag = await prisma.tag.findFirst({ where: { id: req.params.id as string, userId: req.userId } });
    if (!tag) return sendError(res, 'NOT_FOUND', '标签不存在', 404);

    const data = updateTagSchema.parse(req.body);
    const updated = await prisma.tag.update({ where: { id: tag.id }, data });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
}

export async function deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tag = await prisma.tag.findFirst({ where: { id: req.params.id as string, userId: req.userId } });
    if (!tag) return sendError(res, 'NOT_FOUND', '标签不存在', 404);

    await prisma.tag.delete({ where: { id: tag.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}

export async function assignTagToProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body);

    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const tag = await prisma.tag.findFirst({ where: { id: tagId, userId: req.userId } });
    if (!tag) return sendError(res, 'NOT_FOUND', '标签不存在', 404);

    const existing = await prisma.projectTag.findFirst({ where: { projectId: pid, tagId } });
    if (existing) return sendError(res, 'DUPLICATE', '已关联该标签', 409);

    await prisma.projectTag.create({ data: { projectId: pid, tagId } });
    sendSuccess(res, { assigned: true });
  } catch (err) { next(err); }
}

export async function removeTagFromProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid, tagId } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    await prisma.projectTag.deleteMany({ where: { projectId: pid, tagId } });
    sendSuccess(res, { removed: true });
  } catch (err) { next(err); }
}
