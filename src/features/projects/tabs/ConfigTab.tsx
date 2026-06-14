import { useState, useEffect } from 'react';
import { Button, Input, message } from 'antd';
import { SaveOutlined, SearchOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { projectsApi } from '../../../api';
import type { ProjectDetail } from '../../../types';

function CwdInput({ cwd, setCwd, detecting, onDetect, onBrowse }: {
  cwd: string; setCwd: (v: string) => void; detecting: boolean; onDetect: () => void; onBrowse: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <Input
        value={cwd}
        onChange={e => setCwd(e.target.value)}
        placeholder="工作目录（默认项目根目录）"
        style={{ flex: 1 }}
        addonBefore={<FolderOpenOutlined style={{ cursor: 'pointer' }} onClick={onBrowse} />}
      />
      <Button icon={<SearchOutlined />} onClick={onDetect} loading={detecting}>
        自动检测
      </Button>
    </div>
  );
}

export default function ConfigTab({ project, onSaved }: { project: ProjectDetail; onSaved: (p: ProjectDetail) => void }) {
  const [frontendCmd, setFrontendCmd] = useState(project?.frontendCommand || project?.openCommand || '');
  const [backendCmd, setBackendCmd] = useState(project?.backendCommand || '');
  const [frontendCwd, setFrontendCwd] = useState(project?.frontendCwd || '');
  const [backendCwd, setBackendCwd] = useState(project?.backendCwd || '');
  const [saving, setSaving] = useState(false);
  const [detectingFrontend, setDetectingFrontend] = useState(false);
  const [detectingBackend, setDetectingBackend] = useState(false);

  useEffect(() => {
    setFrontendCmd(project?.frontendCommand || project?.openCommand || '');
    setBackendCmd(project?.backendCommand || '');
    setFrontendCwd(project?.frontendCwd || '');
    setBackendCwd(project?.backendCwd || '');
  }, [project?.frontendCommand, project?.backendCommand, project?.openCommand, project?.frontendCwd, project?.backendCwd]);

  const handleDetectCwd = async (command: string, setCwd: (v: string) => void, setDetecting: (v: boolean) => void) => {
    if (!command.trim() || !project?.localPath) return;
    setDetecting(true);
    try {
      const result = await projectsApi.detectCwd(project.localPath, command);
      if (result) {
        setCwd(result);
        message.success(`检测到命令在 "${result}" 目录`);
      } else {
        message.info('未在子目录中找到匹配的命令，将在项目根目录执行');
      }
    } catch {
      message.warning('检测失败');
    } finally {
      setDetecting(false);
    }
  };

  const handleBrowseCwd = async (setCwd: (v: string) => void) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        const relative = selected.replace(project.localPath || '', '').replace(/\\/g, '/').replace(/^\//, '');
        setCwd(relative || '.');
      }
    } catch {
      message.error('无法打开文件夹选择器');
    }
  };

  async function handleSave() {
    if (!frontendCmd.trim() && !backendCmd.trim()) {
      message.warning('请至少输入一个启动命令');
      return;
    }
    setSaving(true);
    try {
      const updated = await projectsApi.update(project.id, {
        frontendCommand: frontendCmd.trim() || undefined,
        backendCommand: backendCmd.trim() || undefined,
        openCommand: frontendCmd.trim() || backendCmd.trim() || undefined,
        frontendCwd: frontendCwd.trim() || undefined,
        backendCwd: backendCwd.trim() || undefined,
      });
      onSaved(updated as ProjectDetail);
      message.success('配置已保存');
    } catch (e: unknown) {
      message.error(String(e) || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, padding: '8px 0' }}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 6 }}>
          <span style={{ color: '#22c55e', marginRight: 4 }}>●</span> 前端命令
        </label>
        <Input value={frontendCmd} onChange={e => setFrontendCmd(e.target.value)} placeholder="如 npm run dev、pnpm dev、yarn start" />
        <CwdInput cwd={frontendCwd} setCwd={setFrontendCwd} detecting={detectingFrontend}
          onDetect={() => handleDetectCwd(frontendCmd, setFrontendCwd, setDetectingFrontend)}
          onBrowse={() => handleBrowseCwd(setFrontendCwd)} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1a1f36', marginBottom: 6 }}>
          <span style={{ color: '#3b82f6', marginRight: 4 }}>●</span> 后端命令（可选）
        </label>
        <Input value={backendCmd} onChange={e => setBackendCmd(e.target.value)} placeholder="如 cargo run、python manage.py runserver" />
        <CwdInput cwd={backendCwd} setCwd={setBackendCwd} detecting={detectingBackend}
          onDetect={() => handleDetectCwd(backendCmd, setBackendCwd, setDetectingBackend)}
          onBrowse={() => handleBrowseCwd(setBackendCwd)} />
      </div>
      <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}
        style={{ background: '#22c55e', borderColor: '#22c55e' }}>
        保存配置
      </Button>
    </div>
  );
}
