import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import queryClient from './lib/queryClient';
import { useThemeStore } from './stores/themeStore';
import './styles/design-system.css';
import './index.css';

function Root() {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';

  // Sync data-theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const themeConfig = useMemo(() => {
    const palette = isDark
      ? {
          primary: '#4fdbc8',
          primaryHover: '#5eead4',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#f87171',
          info: '#38bdf8',
          bgBase: '#0b1018',
          bgContainer: 'rgba(14, 22, 31, 0.88)',
          bgInput: 'rgba(16, 25, 36, 0.90)',
          bgElevated: 'rgba(18, 28, 39, 0.96)',
          border: 'rgba(148, 163, 184, 0.16)',
          borderSecondary: 'rgba(148, 163, 184, 0.10)',
          text: '#eaf1ff',
          textSecondary: '#c0ccc9',
          textTertiary: '#8a9a96',
          tableHeader: 'rgba(148, 163, 184, 0.06)',
          hover: 'rgba(79, 219, 200, 0.08)',
          selected: 'rgba(79, 219, 200, 0.14)',
          shadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
          shadowSecondary: '0 8px 24px rgba(0, 0, 0, 0.38)',
        }
      : {
          primary: '#006b5f',
          primaryHover: '#00423b',
          success: '#16a34a',
          warning: '#d97706',
          error: '#ba1a1a',
          info: '#0ea5e9',
          bgBase: '#f8f9ff',
          bgContainer: 'rgba(255, 255, 255, 0.80)',
          bgInput: 'rgba(255, 255, 255, 0.75)',
          bgElevated: 'rgba(255, 255, 255, 0.90)',
          border: '#e2e8f0',
          borderSecondary: '#eef2f6',
          text: '#0b1c30',
          textSecondary: '#3c4947',
          textTertiary: '#6c7a77',
          tableHeader: 'rgba(255, 255, 255, 0.50)',
          hover: 'rgba(0, 107, 95, 0.08)',
          selected: 'rgba(0, 107, 95, 0.14)',
          shadow: '0 2px 8px rgba(11, 28, 48, 0.06)',
          shadowSecondary: '0 8px 24px rgba(11, 28, 48, 0.10)',
        };

    return {
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: palette.primary,
        colorSuccess: palette.success,
        colorWarning: palette.warning,
        colorError: palette.error,
        colorInfo: palette.info,
        colorBgBase: palette.bgBase,
        colorBgContainer: palette.bgContainer,
        colorBgElevated: palette.bgElevated,
        colorBgLayout: 'transparent',
        colorBorder: palette.border,
        colorBorderSecondary: palette.borderSecondary,
        colorText: palette.text,
        colorTextSecondary: palette.textSecondary,
        colorTextTertiary: palette.textTertiary,
        borderRadius: 8,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        controlHeight: 36,
        boxShadow: palette.shadow,
        boxShadowSecondary: palette.shadowSecondary,
      },
      components: {
        Button: {
          controlHeight: 36,
          borderRadius: 8,
          fontWeight: 500,
          primaryShadow: isDark
            ? '0 2px 10px rgba(79, 219, 200, 0.26)'
            : '0 2px 10px rgba(0, 107, 95, 0.22)',
        },
        Card: {
          borderRadiusLG: 12,
          paddingLG: 20,
          colorBgContainer: palette.bgContainer,
        },
        Input: {
          controlHeight: 36,
          borderRadius: 8,
          colorBgContainer: palette.bgInput,
          activeBorderColor: palette.primary,
        },
        Select: {
          controlHeight: 36,
          borderRadius: 8,
          colorBgContainer: palette.bgInput,
          colorBgElevated: palette.bgElevated,
        },
        Table: {
          borderRadius: 12,
          colorBgContainer: 'transparent',
          headerBg: palette.tableHeader,
          headerColor: palette.textSecondary,
          rowHoverBg: palette.hover,
          colorBorderSecondary: palette.borderSecondary,
        },
        Menu: {
          itemBorderRadius: 8,
          itemMarginInline: 8,
          itemHeight: 36,
          itemBg: 'transparent',
          itemSelectedBg: palette.selected,
          itemSelectedColor: palette.primary,
          itemColor: palette.textSecondary,
          itemHoverColor: palette.text,
          itemHoverBg: palette.hover,
        },
        Tabs: {
          borderRadius: 8,
        },
        Modal: {
          contentBg: palette.bgElevated,
          headerBg: 'transparent',
        },
        Dropdown: {
          colorBgElevated: palette.bgElevated,
        },
        Descriptions: {
          colorBgContainer: palette.bgContainer,
        },
        Tag: {
          borderRadiusSM: 4,
        },
      },
    };
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={themeConfig}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
