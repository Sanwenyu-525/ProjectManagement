import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { config } from '../../config';
import { AuthRequest } from '../../middleware/auth';

const registerSchema = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      return sendError(res, 'USER_EXISTS', '用户名或邮箱已存在', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { username: data.username, email: data.email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    const token = generateToken(user.id);
    sendSuccess(res, { user, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return sendError(res, 'INVALID_CREDENTIALS', '邮箱或密码错误', 401);
    }

    const token = generateToken(user.id);
    sendSuccess(res, {
      user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, avatar: true, createdAt: true },
    });
    if (!user) return sendError(res, 'NOT_FOUND', '用户不存在', 404);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
