import React, { useState, useEffect } from 'react';
import { Card, Alert, Button, Typography, Space, Collapse, Tag, Divider } from 'antd';
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  HomeOutlined,
  QuestionCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface ErrorInfo {
  id: string;
  type: 'network' | 'permission' | 'not_found' | 'server' | 'unknown';
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
  recoveryActions: RecoveryAction[];
}

interface RecoveryAction {
  label: string;
  action: () => void;
  type?: 'primary' | 'default' | 'link';
}

interface ErrorHandlerProps {
  error: ErrorInfo | null;
  onDismiss?: () => void;
}

export function ErrorHandler({ error, onDismiss }: ErrorHandlerProps) {
  const navigate = useNavigate();

  if (!error) return null;

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network': return <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />;
      case 'permission': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'not_found': return <QuestionCircleOutlined style={{ color: '#3b82f6' }} />;
      case 'server': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <ExclamationCircleOutlined style={{ color: '#8b95a5' }} />;
    }
  };

  const getErrorTypeLabel = () => {
    switch (error.type) {
      case 'network': return '网络错误';
      case 'permission': return '权限错误';
      case 'not_found': return '未找到';
      case 'server': return '服务器错误';
      default: return '未知错误';
    }
  };

  const getErrorTypeColor = () => {
    switch (error.type) {
      case 'network': return 'warning';
      case 'permission': return 'error';
      case 'not_found': return 'info';
      case 'server': return 'error';
      default: return 'error';
    }
  };

  return (
    <Alert
      type={getErrorTypeColor() as any}
      icon={getErrorIcon()}
      message={
        <div>
          <Space>
            <Text strong>{error.title}</Text>
            <Tag color={getErrorTypeColor()}>{getErrorTypeLabel()}</Tag>
          </Space>
        </div>
      }
      description={
        <div>
          <Paragraph style={{ margin: '8px 0' }}>{error.message}</Paragraph>
          {error.details && (
            <Collapse
              size="small"
              items={[{
                key: '1',
                label: '查看详情',
                children: (
                  <pre style={{
                    background: 'rgba(0,0,0,0.02)',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    overflow: 'auto',
                    maxHeight: 200,
                  }}>
                    {error.details}
                  </pre>
                ),
              }]}
            />
          )}
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              发生时间：{error.timestamp.toLocaleString('zh-CN')}
            </Text>
          </div>
        </div>
      }
      showIcon
      action={
        <Space>
          {error.recoveryActions.map((action, index) => (
            <Button
              key={index}
              type={action.type || 'default'}
              onClick={action.action}
            >
              {action.label}
            </Button>
          ))}
          {onDismiss && (
            <Button type="link" onClick={onDismiss}>
              关闭
            </Button>
          )}
        </Space>
      }
    />
  );
}

// 错误边界组件
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Alert
            type="error"
            showIcon
            message="页面出现错误"
            description={this.state.error?.message || '未知错误'}
            action={
              <Space>
                <Button onClick={() => window.location.reload()}>
                  刷新页面
                </Button>
                <Button type="primary" onClick={() => this.setState({ hasError: false, error: null })}>
                  重试
                </Button>
              </Space>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// 错误提示工具
export const showError = (message: string, details?: string) => {
  console.error(message, details);
  // 可以集成 notification 或 message 组件
};

export const showNetworkError = () => {
  return {
    type: 'network' as const,
    title: '网络连接失败',
    message: '无法连接到服务器，请检查网络连接',
    recoveryActions: [
      { label: '重试', action: () => window.location.reload(), type: 'primary' },
      { label: '返回首页', action: () => window.location.href = '/' },
    ],
  };
};

export const showPermissionError = () => {
  return {
    type: 'permission' as const,
    title: '权限不足',
    message: '你没有权限执行此操作',
    recoveryActions: [
      { label: '返回首页', action: () => window.location.href = '/' },
    ],
  };
};

export const showNotFoundError = (resource: string) => {
  return {
    type: 'not_found' as const,
    title: '未找到资源',
    message: `找不到指定的${resource}`,
    recoveryActions: [
      { label: '返回列表', action: () => window.history.back() },
      { label: '返回首页', action: () => window.location.href = '/' },
    ],
  };
};

export default ErrorHandler;
