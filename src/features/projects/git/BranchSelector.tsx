import { Select, Badge } from 'antd';
import { BranchesOutlined, CloudSyncOutlined } from '@ant-design/icons';

interface Branch {
  name: string;
  current: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

interface BranchSelectorProps {
  branches: Branch[];
  onSwitch: (branch: string) => void;
  loading?: boolean;
}

export default function BranchSelector({ branches, onSwitch, loading }: BranchSelectorProps) {
  const current = branches.find(b => b.current);
  const localBranches = branches.filter(b => !b.isRemote);
  const remoteBranches = branches.filter(b => b.isRemote);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <BranchesOutlined style={{ color: 'var(--color-text-secondary)', fontSize: 14 }} />
      <Select
        value={current?.name || undefined}
        onChange={onSwitch}
        loading={loading}
        style={{ minWidth: 160 }}
        size="small"
        popupMatchSelectWidth={false}
        options={[
          {
            label: '本地分支',
            options: localBranches.map(b => ({
              value: b.name,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{b.name}</span>
                  {b.current && <Badge color="#22c55e" />}
                </span>
              ),
            })),
          },
          ...(remoteBranches.length > 0
            ? [{
                label: '远程分支',
                options: remoteBranches.map(b => ({
                  value: b.name,
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                      <CloudSyncOutlined style={{ fontSize: 11 }} />
                      <span>{b.name}</span>
                    </span>
                  ),
                })),
              }]
            : []),
        ]}
      />
      {current && (current.ahead > 0 || current.behind > 0) && (
        <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
          {current.ahead > 0 && (
            <span style={{ color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '1px 6px', borderRadius: 4 }}>
              ↑{current.ahead}
            </span>
          )}
          {current.behind > 0 && (
            <span style={{ color: 'var(--color-amber)', background: 'var(--color-amber-light)', padding: '1px 6px', borderRadius: 4 }}>
              ↓{current.behind}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
