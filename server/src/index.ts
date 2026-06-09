import app from './app';
import { config } from './config';
import { prisma } from './utils/prisma';

async function main() {
  await prisma.$connect();
  console.log('✓ Database connected');

  app.listen(config.port, () => {
    console.log(`✓ DevHub server running at http://localhost:${config.port}`);
    console.log(`✓ Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
