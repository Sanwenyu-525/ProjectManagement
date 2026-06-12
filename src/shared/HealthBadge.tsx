import { Tooltip, Badge } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { type HealthData, hasHealthIssues, isHealthUrgent, formatHealthIssues } from '../lib/healthUtils';

export default function HealthBadge({ result }: { result: HealthData | undefined }) {
  if (!result) return null;

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
