import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#22c55e',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#22c55e',
          colorBgBase: '#111827',
          colorBgContainer: '#151d2e',
          colorBgElevated: '#1a2235',
          colorBgLayout: '#0b0f1a',
          colorBorder: '#1e293b',
          colorBorderSecondary: '#1a2235',
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          borderRadius: 8,
          fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
          controlHeight: 38,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.4)',
        },
        components: {
          Button: {
            controlHeight: 38,
            borderRadius: 8,
            fontWeight: 500,
            primaryShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
          },
          Card: {
            borderRadiusLG: 10,
            paddingLG: 20,
            colorBgContainer: '#151d2e',
          },
          Input: {
            controlHeight: 38,
            borderRadius: 8,
            colorBgContainer: '#111827',
            activeBorderColor: '#22c55e',
          },
          Select: {
            controlHeight: 38,
            borderRadius: 8,
            colorBgContainer: '#111827',
          },
          Table: {
            borderRadius: 10,
            colorBgContainer: 'transparent',
            headerBg: '#1a2235',
            headerColor: '#64748b',
            rowHoverBg: '#1a2235',
            colorBorderSecondary: '#1e293b',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 40,
            darkItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(34, 197, 94, 0.12)',
            darkItemSelectedColor: '#22c55e',
            darkItemColor: '#64748b',
            darkItemHoverColor: '#f1f5f9',
            darkItemHoverBg: '#1a2235',
          },
          Tabs: {
            borderRadius: 8,
          },
          Modal: {
            contentBg: '#111827',
            headerBg: '#111827',
          },
          Dropdown: {
            colorBgElevated: '#111827',
          },
          Descriptions: {
            colorBgContainer: '#151d2e',
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
