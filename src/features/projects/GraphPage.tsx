import { useState } from 'react';
import { Select, Empty, Spin } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import GraphTab from './tabs/GraphTab';
import { useProjects } from '../../hooks/useProjects';
import { getThemeColors } from '../../lib/themeColors';

export default function GraphPage() {
  const tc = getThemeColors();
  const { data: projects, isLoading } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      padding: 24,
      gap: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <ApartmentOutlined style={{ fontSize: 20, color: tc.primary }} />
        <span style={{ fontWeight: 600, fontSize: 18, color: tc.text }}>
          项目图谱
        </span>
        <Select
          placeholder="选择项目"
          style={{ width: 280, marginLeft: 'auto' }}
          loading={isLoading}
          value={selectedId}
          onChange={setSelectedId}
          options={projects?.map(p => ({ label: p.name, value: p.id }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </div>

      {/* Graph content */}
      {isLoading ? (
        <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
      ) : selectedId ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <GraphTab projectId={selectedId} />
        </div>
      ) : (
        <Empty
          description="请在上方选择一个项目以查看依赖图谱"
          style={{ marginTop: 80 }}
        />
      )}
    </div>
  );
}
