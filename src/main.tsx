import React, { useEffect, useMemo } from 'react';
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
  const isDark = mode === 'dark';

  // Sync data-theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const themeConfig = useMemo(() => {
    const palette = isDark
      ? {
          primary: '#2dd4bf',
          primaryHover: '#5eead4',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#f87171',
          info: '#38bdf8',
          bgBase: '#090d14',
          bgContainer: 'rgba(14, 22, 31, 0.82)',
          bgInput: 'rgba(16, 25, 36, 0.88)',
          bgElevated: 'rgba(18, 28, 39, 0.96)',
          border: 'rgba(148, 163, 184, 0.14)',
          borderSecondary: 'rgba(148, 163, 184, 0.08)',
          text: '#e5edf5',
          textSecondary: '#9fb1c5',
          textTertiary: '#718196',
          tableHeader: 'rgba(148, 163, 184, 0.06)',
          hover: 'rgba(45, 212, 191, 0.08)',
          selected: 'rgba(45, 212, 191, 0.14)',
          shadow: '0 2px 12px rgba(0, 0, 0, 0.28)',
          shadowSecondary: '0 10px 32px rgba(0, 0, 0, 0.38)',
        }
      : {
          primary: '#14b8a6',
          primaryHover: '#0f766e',
          success: '#16a34a',
          warning: '#d97706',
          error: '#dc2626',
          info: '#0ea5e9',
          bgBase: '#f5fbff',
          bgContainer: 'rgba(255, 255, 255, 0.62)',
          bgInput: 'rgba(255, 255, 255, 0.66)',
          bgElevated: 'rgba(255, 255, 255, 0.92)',
          border: 'rgba(87, 114, 145, 0.16)',
          borderSecondary: 'rgba(87, 114, 145, 0.10)',
          text: '#172033',
          textSecondary: '#526174',
          textTertiary: '#748198',
          tableHeader: 'rgba(255, 255, 255, 0.40)',
          hover: 'rgba(20, 184, 166, 0.08)',
          selected: 'rgba(20, 184, 166, 0.13)',
          shadow: '0 2px 12px rgba(39, 67, 92, 0.06)',
          shadowSecondary: '0 10px 32px rgba(39, 67, 92, 0.10)',
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
        borderRadius: 10,
        fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        controlHeight: 38,
        boxShadow: palette.shadow,
        boxShadowSecondary: palette.shadowSecondary,
      },
      components: {
        Button: {
          controlHeight: 38,
          borderRadius: 10,
          fontWeight: 500,
          primaryShadow: isDark
            ? '0 2px 10px rgba(45, 212, 191, 0.26)'
            : '0 2px 10px rgba(20, 184, 166, 0.22)',
        },
        Card: {
          borderRadiusLG: 12,
          paddingLG: 20,
          colorBgContainer: palette.bgContainer,
        },
        Input: {
          controlHeight: 38,
          borderRadius: 10,
          colorBgContainer: palette.bgInput,
          activeBorderColor: palette.primary,
        },
        Select: {
          controlHeight: 38,
          borderRadius: 10,
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
          itemHeight: 40,
          itemBg: 'transparent',
          itemSelectedBg: palette.selected,
          itemSelectedColor: palette.primary,
          itemColor: palette.textSecondary,
          itemHoverColor: palette.text,
          itemHoverBg: palette.hover,
        },
        Tabs: {
          borderRadius: 10,
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
      },
    };
  }, [isDark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={themeConfig}
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
