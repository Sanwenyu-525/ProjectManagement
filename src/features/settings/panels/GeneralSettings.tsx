import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader, InfoRow } from '../settingsComponents';

export default function GeneralSettings() {
  const [defaultCmd, setDefaultCmd] = useState(localStorage.getItem('devhub_default_open_cmd') || 'code {path}');

  const handleSave = () => {
    localStorage.setItem('devhub_default_open_cmd', defaultCmd);
    message.success('设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="应用信息" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoRow label="应用名称" value="DevHub" />
            <InfoRow label="版本" value="v0.1.0" />
            <InfoRow label="模式" value="单用户本地模式" />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="偏好设置" />
        <div style={{ padding: '16px 24px 20px' }}>
          <Form layout="vertical">
            <Form.Item label="默认打开命令">
              <Input
                value={defaultCmd}
                onChange={e => setDefaultCmd(e.target.value)}
                placeholder="code {path}"
              />
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                {'{path}'} 会被替换为项目本地路径。常用: code {'{path}'}、webstorm {'{path}'}
              </div>
            </Form.Item>
          </Form>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultCmd('code {path}');
            localStorage.removeItem('devhub_default_open_cmd');
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
