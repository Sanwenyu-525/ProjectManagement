import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { useThemeStore } from './stores/themeStore';
import './styles/design-system.css';
import './index.css';

function Root() {
  const mode = useThemeStore(s => s.mode);

  // Sync data-theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#22c55e',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#22c55e',
          colorBgBase: mode === 'dark' ? '#0f1019' : '#ffffff',
          colorBgContainer: mode === 'dark' ? 'rgba(22, 24, 33, 0.7)' : 'rgba(255, 255, 255, 0.55)',
          colorBgElevated: mode === 'dark' ? 'rgba(30, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          colorBgLayout: 'transparent',
          colorBorder: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          colorBorderSecondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          colorText: mode === 'dark' ? '#e2e8f0' : '#1a1f36',
          colorTextSecondary: mode === 'dark' ? '#94a3b8' : '#6b7a99',
          colorTextTertiary: mode === 'dark' ? '#64748b' : '#7b8fa3',
          borderRadius: 10,
          fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
          controlHeight: 38,
          boxShadow: mode === 'dark'
            ? '0 2px 12px rgba(0, 0, 0, 0.25)'
            : '0 2px 12px rgba(0, 0, 0, 0.04)',
          boxShadowSecondary: mode === 'dark'
            ? '0 6px 24px rgba(0, 0, 0, 0.3)'
            : '0 6px 24px rgba(0, 0, 0, 0.06)',
        },
        components: {
          Button: {
            controlHeight: 38,
            borderRadius: 10,
            fontWeight: 500,
            primaryShadow: '0 2px 8px rgba(34, 197, 94, 0.25)',
          },
          Card: {
            borderRadiusLG: 12,
            paddingLG: 20,
            colorBgContainer: mode === 'dark' ? 'rgba(22, 24, 33, 0.7)' : 'rgba(255, 255, 255, 0.55)',
          },
          Input: {
            controlHeight: 38,
            borderRadius: 10,
            colorBgContainer: mode === 'dark' ? 'rgba(30, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.65)',
            activeBorderColor: '#22c55e',
          },
          Select: {
            controlHeight: 38,
            borderRadius: 10,
            colorBgContainer: mode === 'dark' ? 'rgba(30, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.65)',
            colorBgElevated: mode === 'dark' ? 'rgba(30, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          },
          Table: {
            borderRadius: 12,
            colorBgContainer: 'transparent',
            headerBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            headerColor: mode === 'dark' ? '#94a3b8' : '#9eadc0',
            rowHoverBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            colorBorderSecondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 40,
            itemBg: 'transparent',
            itemSelectedBg: mode === 'dark' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.10)',
            itemSelectedColor: '#22c55e',
            itemColor: mode === 'dark' ? '#94a3b8' : '#6b7a99',
            itemHoverColor: mode === 'dark' ? '#e2e8f0' : '#1a1f36',
            itemHoverBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          },
          Tabs: {
            borderRadius: 10,
          },
          Modal: {
            contentBg: mode === 'dark' ? 'rgba(22, 24, 33, 0.95)' : 'rgba(255, 255, 255, 0.85)',
            headerBg: 'transparent',
          },
          Dropdown: {
            colorBgElevated: mode === 'dark' ? 'rgba(30, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.88)',
          },
          Descriptions: {
            colorBgContainer: mode === 'dark' ? 'rgba(22, 24, 33, 0.5)' : 'rgba(255, 255, 255, 0.45)',
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
