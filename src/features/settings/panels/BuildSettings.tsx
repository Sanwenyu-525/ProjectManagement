import { useState } from 'react';
import { Input, Button, message, InputNumber } from 'antd';
import { SaveOutlined, UndoOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader } from '../settingsComponents';

export default function BuildSettings() {
  const [defaultBuildCmd, setDefaultBuildCmd] = useState(localStorage.getItem('devhub_build_default_cmd') || '');
  const [defaultRunCmd, setDefaultRunCmd] = useState(localStorage.getItem('devhub_build_default_run') || '');
  const [timeout, setTimeout_] = useState(Number(localStorage.getItem('devhub_build_timeout')) || 300);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('devhub_build_global_env') || '[]');
    } catch { return []; }
  });

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...envVars];
    next[index] = { ...next[index], [field]: val };
    setEnvVars(next);
  };

  const handleSave = () => {
    localStorage.setItem('devhub_build_default_cmd', defaultBuildCmd);
    localStorage.setItem('devhub_build_default_run', defaultRunCmd);
    localStorage.setItem('devhub_build_timeout', String(timeout));
    localStorage.setItem('devhub_build_global_env', JSON.stringify(envVars.filter(e => e.key)));
    message.success('构建设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="构建设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认构建命令</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>项目未配置时使用的 fallback 构建命令</div>
            <Input
              value={defaultBuildCmd}
              onChange={e => setDefaultBuildCmd(e.target.value)}
              placeholder="npm run build"
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认运行命令</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>项目未配置时使用的 fallback 运行命令</div>
            <Input
              value={defaultRunCmd}
              onChange={e => setDefaultRunCmd(e.target.value)}
              placeholder="npm run dev"
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>构建超时（秒）</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>构建过程的最大等待时间</div>
            <InputNumber
              value={timeout}
              onChange={v => setTimeout_(v || 300)}
              min={30}
              max={3600}
              step={30}
              style={{ width: 160 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>全局环境变量</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>所有构建过程中注入的环境变量</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {envVars.map((env, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={env.key}
                    onChange={e => updateEnvVar(i, 'key', e.target.value)}
                    placeholder="KEY"
                    style={{ width: 180, fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
                  />
                  <span style={{ color: 'var(--md-on-surface-variant)' }}>=</span>
                  <Input
                    value={env.value}
                    onChange={e => updateEnvVar(i, 'value', e.target.value)}
                    placeholder="value"
                    style={{ flex: 1, fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeEnvVar(i)}
                  />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addEnvVar}
                style={{ alignSelf: 'flex-start' }}
              >
                添加变量
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultBuildCmd('');
            setDefaultRunCmd('');
            setTimeout_(300);
            setEnvVars([]);
            localStorage.removeItem('devhub_build_default_cmd');
            localStorage.removeItem('devhub_build_default_run');
            localStorage.removeItem('devhub_build_timeout');
            localStorage.removeItem('devhub_build_global_env');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}
