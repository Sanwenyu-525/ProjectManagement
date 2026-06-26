import { useState } from 'react';
import { Form, Input, Select, Button, message } from 'antd';
import { SaveOutlined, FolderOutlined } from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import { useTerminalStore } from '../../../stores/terminalStore';
import { DEFAULT_SHELL, DEFAULT_CWD, SHELL_OPTIONS } from '../../../lib/constants';
import { GlassCard, CardHeader } from '../settingsComponents';

export default function TerminalSettings() {
  const [terminalShell, setTerminalShell] = useState(localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL);
  const [defaultCwd, setDefaultCwd] = useState(localStorage.getItem('devhub_terminal_default_cwd') || DEFAULT_CWD);

  const handleSave = () => {
    localStorage.setItem('devhub_terminal_shell', terminalShell);
    localStorage.setItem('devhub_terminal_default_cwd', defaultCwd);
    useTerminalStore.setState({ defaultCwd });
    message.success('终端设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="终端设置" />
        <div style={{ padding: '16px 24px 20px' }}>
          <Form layout="vertical">
            <Form.Item label="终端 Shell">
              <Select
                value={terminalShell}
                onChange={setTerminalShell}
                options={SHELL_OPTIONS.map(o => ({ ...o, label: o.value === DEFAULT_SHELL ? `${o.label}（默认）` : o.label }))}
                style={{ width: 220 }}
              />
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                新建终端时使用的 Shell。修改后需重新打开终端面板生效。
              </div>
            </Form.Item>
            <Form.Item label="终端默认路径">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={defaultCwd}
                  onChange={e => setDefaultCwd(e.target.value)}
                  placeholder={DEFAULT_CWD}
                  style={{ flex: 1 }}
                />
                <Button
                  icon={<FolderOutlined />}
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      defaultPath: defaultCwd || undefined,
                    });
                    if (selected) setDefaultCwd(selected);
                  }}
                >
                  选择
                </Button>
              </div>
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                点击全局终端按钮时打开的默认路径。启动项目时会使用项目路径。
              </div>
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
            </Form.Item>
          </Form>
        </div>
      </GlassCard>
    </div>
  );
}
