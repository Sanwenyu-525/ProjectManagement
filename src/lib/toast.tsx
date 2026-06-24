import { message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

export function toastSuccess(text: string, undo?: () => void) {
  message.open({
    content: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{text}</span>
        {undo && (
          <button
            onClick={() => { undo(); message.destroy(); }}
            style={{
              color: 'var(--md-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              padding: 0,
            }}
          >
            撤销
          </button>
        )}
      </span>
    ),
    duration: undo ? 5 : 3,
    icon: <CheckCircleOutlined style={{ color: 'var(--md-primary)' }} />,
  });
}

export function toastError(text: string) {
  message.open({
    content: text,
    icon: <CloseCircleOutlined style={{ color: 'var(--md-error, #f44336)' }} />,
    duration: 4,
  });
}

export function toastWarning(text: string) {
  message.open({
    content: text,
    icon: <ExclamationCircleOutlined style={{ color: 'var(--md-warning, #ff9800)' }} />,
    duration: 3,
  });
}
