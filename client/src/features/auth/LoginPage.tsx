import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, CodeOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; email: string; password: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.email, values.password);
      message.success('注册成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#0b0f1a',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%)',
        top: '20%',
        left: '30%',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.05) 0%, transparent 70%)',
        bottom: '10%',
        right: '20%',
        filter: 'blur(60px)',
      }} />

      {/* Grid lines */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }} />

      {/* Login card */}
      <div
        className="animate-in"
        style={{
          width: 400,
          background: 'rgba(17, 24, 39, 0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(34, 197, 94, 0.15)',
          borderRadius: 16,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 197, 94, 0.05)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 0 24px rgba(34, 197, 94, 0.3)',
          }}>
            <CodeOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#f1f5f9',
            letterSpacing: '-0.5px',
            fontFamily: "'Fira Code', monospace",
          }}>
            DevHub
          </div>
          <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6, display: 'block' }}>
            开发者项目管理平台
          </Text>
        </div>

        <Tabs
          centered
          items={[
            {
              key: 'login',
              label: <span style={{ color: '#94a3b8', fontWeight: 500 }}>登录</span>,
              children: (
                <Form onFinish={handleLogin} size="large" autoComplete="off">
                  <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                    <Input
                      prefix={<MailOutlined style={{ color: '#475569' }} />}
                      placeholder="邮箱"
                      style={{ background: '#0b0f1a', border: '1px solid #1e293b', borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password
                      prefix={<LockOutlined style={{ color: '#475569' }} />}
                      placeholder="密码"
                      style={{ background: '#0b0f1a', border: '1px solid #1e293b', borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      style={{
                        height: 42,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        background: '#22c55e',
                        boxShadow: '0 2px 12px rgba(34, 197, 94, 0.35)',
                      }}
                    >
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: <span style={{ color: '#94a3b8', fontWeight: 500 }}>注册</span>,
              children: (
                <Form onFinish={handleRegister} size="large" autoComplete="off">
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 2, message: '至少2个字符' }]}>
                    <Input
                      prefix={<UserOutlined style={{ color: '#475569' }} />}
                      placeholder="用户名"
                      style={{ background: '#0b0f1a', border: '1px solid #1e293b', borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                    <Input
                      prefix={<MailOutlined style={{ color: '#475569' }} />}
                      placeholder="邮箱"
                      style={{ background: '#0b0f1a', border: '1px solid #1e293b', borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6个字符' }]}>
                    <Input.Password
                      prefix={<LockOutlined style={{ color: '#475569' }} />}
                      placeholder="密码"
                      style={{ background: '#0b0f1a', border: '1px solid #1e293b', borderRadius: 8 }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                      style={{
                        height: 42,
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        background: '#22c55e',
                        boxShadow: '0 2px 12px rgba(34, 197, 94, 0.35)',
                      }}
                    >
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
