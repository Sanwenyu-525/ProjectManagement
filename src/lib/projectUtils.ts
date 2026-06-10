/**
 * 根据项目技术栈生成启动提示
 * @param project 项目对象（需要有 techStack 和 openCommand 字段）
 * @returns 启动提示数组
 */
export function getLaunchHints(project: { techStack?: string[]; openCommand?: string }): string[] {
  const hints: string[] = [];
  const techStack = project.techStack || [];
  const command = project.openCommand || '';

  // 移动端开发提示
  if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) {
    hints.push('移动端项目：启动后需要在模拟器或真机上运行');
  }

  // React Native 特定
  if (techStack.some((t: string) => /react.native/i.test(t))) {
    if (command.includes('android')) {
      hints.push('Android 调试：确保已连接设备或启动模拟器');
    }
    if (command.includes('ios')) {
      hints.push('iOS 调试：需要在 macOS 上运行，确保 Xcode 已安装');
    }
    if (!command.includes('android') && !command.includes('ios')) {
      hints.push('React Native：请确保已启动模拟器或连接真机');
    }
  }

  // Flutter 特定
  if (techStack.some((t: string) => /flutter/i.test(t))) {
    hints.push('Flutter：确保 Flutter SDK 已安装，设备已连接');
  }

  // Electron/桌面应用提示
  if (techStack.some((t: string) => /electron|tauri/i.test(t))) {
    hints.push('桌面应用：将启动独立的桌面窗口');
  }

  // 后端/服务端提示
  if (techStack.some((t: string) => /express|fastify|nest|django|flask|spring|rails/i.test(t))) {
    hints.push('后端服务：启动后可通过浏览器访问应用');
  }

  // Docker 提示
  if (techStack.some((t: string) => /docker|kubernetes|k8s/i.test(t))) {
    hints.push('容器化应用：确保 Docker 已安装并运行');
  }

  // Python 特定
  if (techStack.some((t: string) => /python|flask|django/i.test(t))) {
    hints.push('Python 项目：确保已激活虚拟环境');
  }

  // 数据库依赖
  if (techStack.some((t: string) => /postgres|mysql|mongodb|redis|sql/i.test(t))) {
    hints.push('数据库依赖：确保数据库服务已启动');
  }

  // Node.js 特定
  if (techStack.some((t: string) => /node|express|fastify|nest/i.test(t))) {
    if (command.includes('dev')) {
      hints.push('开发服务器：启动后支持热重载');
    }
  }

  return hints;
}

/**
 * 浏览目录选择器
 * @param onSelect 选择目录后的回调函数
 */
export async function browseDirectory(onSelect: (path: string) => void): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (selected) {
      onSelect(selected as string);
    }
  } catch {
    console.error('无法打开文件夹选择器');
  }
}
