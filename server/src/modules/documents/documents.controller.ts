import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const createDocSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  type: z.enum(['Doc', 'Note', 'Changelog', 'Decision']).optional(),
});

const updateDocSchema = createDocSchema.partial();

export async function getDocuments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.pid as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const docs = await prisma.document.findMany({
      where: { projectId: req.params.pid as string },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, type: true, createdAt: true, updatedAt: true },
    });
    sendSuccess(res, docs);
  } catch (err) { next(err); }
}

export async function createDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.pid as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const data = createDocSchema.parse(req.body);
    const doc = await prisma.document.create({ data: { ...data, projectId: req.params.pid as string } });
    sendSuccess(res, doc, 201);
  } catch (err) { next(err); }
}

export async function getDocumentById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!doc) return sendError(res, 'NOT_FOUND', '文档不存在', 404);
    sendSuccess(res, doc);
  } catch (err) { next(err); }
}

export async function updateDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!doc) return sendError(res, 'NOT_FOUND', '文档不存在', 404);

    const data = updateDocSchema.parse(req.body);
    const updated = await prisma.document.update({ where: { id: doc.id }, data });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
}

export async function deleteDocument(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!doc) return sendError(res, 'NOT_FOUND', '文档不存在', 404);

    await prisma.document.delete({ where: { id: doc.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
}
