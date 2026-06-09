import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/projects/projects.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import repoRoutes from './modules/repos/repos.routes';
import documentRoutes from './modules/documents/documents.routes';
import timelineRoutes from './modules/timeline/timeline.routes';
import milestoneRoutes from './modules/milestones/milestones.routes';
import tagRoutes from './modules/tags/tags.routes';
import searchRoutes from './modules/search/search.routes';

const app = express();

// 中间件
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));

// 健康检查（无需认证）
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', repoRoutes);
app.use('/api', documentRoutes);
app.use('/api', timelineRoutes);
app.use('/api', milestoneRoutes);
app.use('/api', tagRoutes);
app.use('/api', searchRoutes);

// 错误处理
app.use(errorHandler);

export default app;
