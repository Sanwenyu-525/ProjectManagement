import type { ProjectWithStats } from '../../types';
import { getEffectiveCommand } from '../../lib/launchUtils';

// ── Priority Logic ──

export function getProjectPriority(project: ProjectWithStats): number {
  const techStack = project.techStack || [];

  if (techStack.some((t: string) => /postgres|mysql|mongodb|redis|rabbitmq|kafka/i.test(t))) return 1;
  if (techStack.some((t: string) => /docker|kubernetes|k8s/i.test(t))) return 1;
  if (techStack.some((t: string) => /express|fastify|nest|django|flask|spring|rails/i.test(t))) return 2;
  if (techStack.some((t: string) => /react|vue|angular|next|nuxt|svelte|vite/i.test(t))) return 3;
  if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) return 4;
  if (techStack.some((t: string) => /electron|tauri/i.test(t))) return 4;
  return 5;
}

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return '基础设施';
    case 2: return '后端服务';
    case 3: return '前端应用';
    case 4: return '客户端';
    default: return '其他';
  }
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1: return 'red';
    case 2: return 'blue';
    case 3: return 'green';
    case 4: return 'orange';
    default: return 'default';
  }
}

// ── Port Extraction ──

export function extractPortFromCommand(command: string): number | null {
  const portMatch = command.match(/PORT=(\d+)/);
  if (portMatch) return parseInt(portMatch[1], 10);

  const portArgMatch = command.match(/--port[=\s]+(\d+)/);
  if (portArgMatch) return parseInt(portArgMatch[1], 10);

  if (command.includes('react') || command.includes('vue') || command.includes('next') || command.includes('vite')) return 3000;
  if (command.includes('django') || command.includes('flask')) return 8000;
  if (command.includes('express') || command.includes('fastify') || command.includes('nest')) return 3000;

  return 3000;
}

// ── Launch Hints ──

export function getLaunchHints(project: ProjectWithStats): string[] {
  const hints: string[] = [];
  const techStack = project.techStack || [];
  const command = getEffectiveCommand(project) || '';

  if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) {
    hints.push('移动端项目：启动后需要在模拟器或真机上运行');
  }

  if (techStack.some((t: string) => /react.native/i.test(t))) {
    if (command.includes('android')) hints.push('Android 调试：确保已连接设备或启动模拟器');
    if (command.includes('ios')) hints.push('iOS 调试：需要在 macOS 上运行，确保 Xcode 已安装');
    if (!command.includes('android') && !command.includes('ios')) {
      hints.push('React Native：请确保已启动模拟器或连接真机');
    }
  }

  if (techStack.some((t: string) => /flutter/i.test(t))) {
    hints.push('Flutter：确保 Flutter SDK 已安装，设备已连接');
  }

  if (techStack.some((t: string) => /electron|tauri/i.test(t))) {
    hints.push('桌面应用：将启动独立的桌面窗口');
  }

  if (command.includes('docker')) {
    hints.push('Docker：确保 Docker Desktop 正在运行');
  }

  if (command.includes('android')) {
    hints.push('Android：确保已连接设备或启动模拟器');
  }

  if (command.includes('ios') && !command.includes('android')) {
    hints.push('iOS：需要在 macOS 上运行');
  }

  return hints;
}
