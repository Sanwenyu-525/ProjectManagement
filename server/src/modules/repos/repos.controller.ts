import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const addRepoSchema = z.object({
  platform: z.enum(['GitHub', 'GitLab', 'Gitee', 'Bitbucket']),
  repoUrl: z.string().url(),
  repoFullName: z.string(), // user/repo
  defaultBranch: z.string().optional(),
  integrationId: z.string().uuid().optional(),
});

const updateRepoSchema = z.object({
  defaultBranch: z.string().optional(),
  repoStatus: z.string().optional(),
  extraConfig: z.string().optional(),
  integrationId: z.string().uuid().optional().nullable(),
});

export async function getRepos(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const repos = await prisma.remoteRepo.findMany({
      where: { projectId: pid },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, repos);
  } catch (err) {
    next(err);
  }
}

export async function addRepo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pid } = req.params;
    const project = await prisma.project.findFirst({ where: { id: pid, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const data = addRepoSchema.parse(req.body);

    // 检查是否重复关联
    const existing = await prisma.remoteRepo.findFirst({ where: { projectId: pid, repoUrl: data.repoUrl } });
    if (existing) return sendError(res, 'DUPLICATE', '该仓库已关联', 409);

    const repo = await prisma.remoteRepo.create({ data: { ...data, projectId: pid } });

    // 如果项目之前是纯本地，更新为混合
    if (project.source === 'Local') {
      await prisma.project.update({ where: { id: pid }, data: { source: 'Hybrid' } });
    }

    sendSuccess(res, repo, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateRepo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const repo = await prisma.remoteRepo.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!repo) return sendError(res, 'NOT_FOUND', '仓库不存在', 404);

    const data = updateRepoSchema.parse(req.body);
    const updated = await prisma.remoteRepo.update({ where: { id: repo.id }, data });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function removeRepo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const repo = await prisma.remoteRepo.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!repo) return sendError(res, 'NOT_FOUND', '仓库不存在', 404);

    await prisma.remoteRepo.delete({ where: { id: repo.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function syncRepo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const repo = await prisma.remoteRepo.findFirst({
      where: { id: req.params.id as string, project: { ownerId: req.userId } },
    });
    if (!repo) return sendError(res, 'NOT_FOUND', '仓库不存在', 404);

    // TODO: 实际的同步逻辑（调用 GitHub/GitLab/Gitee API）
    // 暂时只更新同步时间
    const updated = await prisma.remoteRepo.update({
      where: { id: repo.id },
      data: { lastSyncAt: new Date(), repoStatus: 'Synced' },
    });

    await prisma.activityLog.create({
      data: { action: 'repo_synced', entityType: 'RemoteRepo', entityId: repo.id, details: JSON.stringify({ platform: repo.platform, repo: repo.repoFullName }), projectId: repo.projectId },
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}
