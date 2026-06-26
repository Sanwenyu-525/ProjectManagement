import { Button, message } from 'antd';
import { GlassCard, CardHeader } from '../settingsComponents';

export default function DataManagementSettings() {
  const handleExport = async () => {
    try {
      const data = {
        preferences: { defaultOpenCmd: localStorage.getItem('devhub_default_open_cmd') },
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="数据导出" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-base)', marginBottom: 12 }}>
            导出本地偏好设置。项目数据存储在服务端数据库中。
          </div>
          <Button onClick={handleExport}>导出设置</Button>
        </div>
      </GlassCard>
    </div>
  );
}
