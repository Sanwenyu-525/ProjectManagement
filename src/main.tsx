import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/design-system.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#22c55e',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#22c55e',
          colorBgBase: '#ffffff',
          colorBgContainer: 'rgba(255, 255, 255, 0.55)',
          colorBgElevated: 'rgba(255, 255, 255, 0.72)',
          colorBgLayout: 'transparent',
          colorBorder: 'rgba(0, 0, 0, 0.06)',
          colorBorderSecondary: 'rgba(0, 0, 0, 0.04)',
          colorText: '#1a1f36',
          colorTextSecondary: '#6b7a99',
          colorTextTertiary: '#9eadc0',
          borderRadius: 10,
          fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
          controlHeight: 38,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
          boxShadowSecondary: '0 6px 24px rgba(0, 0, 0, 0.06)',
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
            colorBgContainer: 'rgba(255, 255, 255, 0.55)',
          },
          Input: {
            controlHeight: 38,
            borderRadius: 10,
            colorBgContainer: 'rgba(255, 255, 255, 0.65)',
            activeBorderColor: '#22c55e',
          },
          Select: {
            controlHeight: 38,
            borderRadius: 10,
            colorBgContainer: 'rgba(255, 255, 255, 0.65)',
          },
          Table: {
            borderRadius: 12,
            colorBgContainer: 'transparent',
            headerBg: 'rgba(0, 0, 0, 0.03)',
            headerColor: '#9eadc0',
            rowHoverBg: 'rgba(0, 0, 0, 0.02)',
            colorBorderSecondary: 'rgba(0, 0, 0, 0.04)',
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 40,
            itemBg: 'transparent',
            itemSelectedBg: 'rgba(34, 197, 94, 0.10)',
            itemSelectedColor: '#22c55e',
            itemColor: '#6b7a99',
            itemHoverColor: '#1a1f36',
            itemHoverBg: 'rgba(0, 0, 0, 0.04)',
          },
          Tabs: {
            borderRadius: 10,
          },
          Modal: {
            contentBg: 'rgba(255, 255, 255, 0.85)',
            headerBg: 'transparent',
          },
          Dropdown: {
            colorBgElevated: 'rgba(255, 255, 255, 0.88)',
          },
          Descriptions: {
            colorBgContainer: 'rgba(255, 255, 255, 0.45)',
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
