import { LaunchRequest } from '../stores/terminalStore';

/** Resolve the effective command for a project: frontend > backend > open. */
export function getEffectiveCommand(project: {
  frontendCommand?: string | null;
  backendCommand?: string | null;
  openCommand?: string | null;
}): string {
  return project.frontendCommand || project.backendCommand || project.openCommand || '';
}

/**
 * Build terminal launch requests for a project.
 * Resolves cwd per-command: configured cwd > project.localPath.
 */
export function buildLaunchRequests(project: {
  id: string;
  localPath: string;
  frontendCommand?: string | null;
  backendCommand?: string | null;
  openCommand?: string | null;
  frontendCwd?: string | null;
  backendCwd?: string | null;
  name: string;
}): LaunchRequest[] {
  const { id, localPath, frontendCommand, backendCommand, frontendCwd, backendCwd, name } = project;

  const resolveCwd = (cwd: string | null | undefined): string => {
    if (!cwd) return localPath;
    // Already absolute (e.g. "D:\..." or "/home/...")
    if (/^[A-Z]:\\/i.test(cwd) || cwd.startsWith('/')) return cwd;
    // Relative path — resolve against project root
    return `${localPath}\\${cwd}`;
  };

  if (frontendCommand && backendCommand) {
    return [
      { cwd: resolveCwd(frontendCwd), command: frontendCommand, label: `${name} - 前端`, projectId: id },
      { cwd: resolveCwd(backendCwd), command: backendCommand, label: `${name} - 后端`, projectId: id },
    ];
  }

  const cmd = getEffectiveCommand(project);
  if (!cmd) return [];

  return [{ cwd: localPath, command: cmd, label: name, projectId: id }];
}
