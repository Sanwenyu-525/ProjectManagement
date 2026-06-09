import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import { exec } from 'child_process';
import { existsSync } from 'fs';

// ==================== 验证 Schema ====================

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  source: z.enum(['Local', 'Remote', 'Hybrid']).optional(),
  localPath: z.string().optional(),
  openCommand: z.string().optional(),
  liveUrl: z.string().optional(),
  domainName: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const VALID_STATUSES = ['Idea', 'Planning', 'Development', 'Testing', 'Deployed', 'Maintained', 'Archived'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// ==================== 工具函数 ====================

function parseTechStack(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function formatProject(p: any) {
  return { ...p, techStack: parseTechStack(p.techStack) };
}

// ==================== 控制器 ====================

export async function getProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status, priority, source, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;

    const where: any = { ownerId: req.userId };
    if (status) where.status = String(status);
    if (priority) where.priority = String(priority);
    if (source) where.source = String(source);
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { description: { contains: String(search) } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { [String(sortBy)]: sortOrder === 'asc' ? 'asc' : 'desc' },
      include: {
        remoteRepos: { select: { id: true, platform: true, repoFullName: true, repoStatus: true } },
        _count: { select: { tasks: true, documents: true } },
      },
    });

    sendSuccess(res, projects.map(formatProject));
  } catch (err) {
    next(err);
  }
}

export async function getProjectById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id as string, ownerId: req.userId },
      include: {
        remoteRepos: true,
        milestones: true,
        tags: { include: { tag: true } },
        _count: { select: { tasks: true, documents: true } },
      },
    });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);
    sendSuccess(res, formatProject(project));
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        ...data,
        techStack: JSON.stringify(data.techStack || []),
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        ownerId: req.userId!,
      },
    });
    sendSuccess(res, formatProject(project), 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = updateProjectSchema.parse(req.body);
    const project = await prisma.project.findFirst({ where: { id: req.params.id as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...data,
        techStack: data.techStack ? JSON.stringify(data.techStack) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      },
    });
    sendSuccess(res, formatProject(updated));
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    await prisma.project.delete({ where: { id: project.id } });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function updateProjectStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    if (!VALID_STATUSES.includes(status)) {
      return sendError(res, 'INVALID_STATUS', `状态必须是: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const project = await prisma.project.findFirst({ where: { id: req.params.id as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { status },
    });

    await prisma.activityLog.create({
      data: {
        action: 'status_change',
        entityType: 'Project',
        entityId: project.id,
        details: JSON.stringify({ from: project.status, to: status }),
        projectId: project.id,
      },
    });

    sendSuccess(res, formatProject(updated));
  } catch (err) {
    next(err);
  }
}

export async function getProjectStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id as string, ownerId: req.userId } });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    const tasks = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId: project.id },
      _count: true,
    });

    const totalTasks = tasks.reduce((sum, t) => sum + t._count, 0);
    const doneTasks = tasks.find(t => t.status === 'Done')?._count || 0;

    sendSuccess(res, {
      taskStats: Object.fromEntries(tasks.map(t => [t.status, t._count])),
      totalTasks,
      doneTasks,
      completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
}

export async function openProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id as string, ownerId: req.userId },
      include: { remoteRepos: true },
    });
    if (!project) return sendError(res, 'NOT_FOUND', '项目不存在', 404);

    let targetPath = project.localPath;

    // 没有本地路径时，检查是否有远程仓库可 clone
    if (!targetPath) {
      const primaryRepo = project.remoteRepos.find(r => r.platform === 'GitHub') || project.remoteRepos[0];
      if (!primaryRepo) {
        return sendError(res, 'NO_PATH', '项目没有本地路径，也没有关联远程仓库', 400);
      }
      // TODO: 实现 clone 逻辑
      return sendError(res, 'NOT_IMPLEMENTED', '自动 clone 功能尚未实现，请手动设置本地路径', 501);
    }

    if (!existsSync(targetPath)) {
      return sendError(res, 'PATH_NOT_FOUND', `本地路径不存在: ${targetPath}`, 400);
    }

    const command = (project.openCommand || 'code .').replace(/\{path\}/g, targetPath);
    exec(command, { cwd: targetPath }, (error) => {
      if (error) {
        return sendError(res, 'LAUNCH_ERROR', `启动失败: ${error.message}`, 500);
      }
    });

    sendSuccess(res, { launched: true, path: targetPath, command });
  } catch (err) {
    next(err);
  }
}
