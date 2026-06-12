import { Tooltip, Badge } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { type HealthData, hasHealthIssues, isHealthUrgent, formatHealthIssues, getScoreColor } from '../lib/healthUtils';

export default function HealthBadge({ result }: { result: HealthData | undefined }) {
  if (!result) return null;

  if (result.healthScore != null) {
    const score = result.healthScore;
    const color = getScoreColor(score);
    const issues = formatHealthIssues(result);
    const label = score >= 80 ? '良好' : score >= 50 ? '注意' : '风险';
    const StatusIcon = score >= 80 ? CheckCircleOutlined : score >= 50 ? WarningOutlined : CloseCircleOutlined;

    return (
      <Tooltip title={issues.length > 0 ? `健康评分: ${score}/100\n${issues.join('；')}` : `健康评分: ${score}/100 — 状态良好`}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 600, color,
          padding: '1px 6px', borderRadius: 4,
          background: `${color}14`,
          marginLeft: 6,
        }}>
          <StatusIcon style={{ fontSize: 12 }} />
          {score} {label}
        </span>
      </Tooltip>
    );
  }

  // Fallback to old icon-based display
  if (!hasHealthIssues(result)) {
    return (
      <Tooltip title="项目状态正常">
        <Badge
          count={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
          offset={[-2, 0]}
          size="small"
        />
      </Tooltip>
    );
  }

  const issues = formatHealthIssues(result);

  return (
    <Tooltip title={issues.join('；')}>
      <Badge
        count={
          isHealthUrgent(result)
            ? <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
            : <WarningOutlined style={{ color: '#faad14', fontSize: 14 }} />
        }
        offset={[-2, 0]}
        size="small"
      />
    </Tooltip>
  );
}
