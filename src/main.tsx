import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import queryClient from './lib/queryClient';
import { useThemeStore, initThemeFromStorage } from './stores/themeStore';
import './styles/material-symbols.css';
import './styles/design-system.css';
import './index.css';

// Disable native Chromium context menu in production (devtools need right-click to work in dev)
const isDevMode = window.location.hostname === 'localhost';
if (!isDevMode) {
  document.addEventListener('contextmenu', e => e.preventDefault());
}

/**
 * Read a CSS custom property value from the document root.
 * getComputedStyle resolves var() references, so we get the final computed value.
 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function Root() {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const accent = useThemeStore(s => s.accent);
  const density = useThemeStore(s => s.density);

  // Sync data-theme/data-density attributes on <html> + apply accent/fontSize
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-density', density);
    initThemeFromStorage();
  }, [mode, density]);

  const themeConfig = useMemo(() => {
    // ── Single source of truth: read all values from CSS variables ──
    const v = {
      // Core palette
      primary: cssVar('--color-primary'),
      primaryHover: cssVar('--color-primary-dark'),
      success: cssVar('--color-success'),
      warning: cssVar('--color-warning'),
      error: cssVar('--color-error'),
      info: cssVar('--color-info'),

      // Surfaces
      bgBase: cssVar('--color-bg-base'),
      bgContainer: cssVar('--color-bg-card'),
      bgInput: cssVar('--color-bg-input'),
      bgElevated: cssVar('--color-bg-elevated'),

      // Borders
      border: cssVar('--color-border'),
      borderSecondary: cssVar('--color-border-subtle'),

      // Text
      text: cssVar('--color-text-primary'),
      textSecondary: cssVar('--color-text-secondary'),
      textTertiary: cssVar('--color-text-tertiary'),

      // Functional
      divider: cssVar('--color-divider'),
      hover: cssVar('--ws-hover'),
      selected: cssVar('--ws-active-bg'),
      shadow: cssVar('--shadow-sm'),
      shadowSecondary: cssVar('--shadow-lg'),
      btnShadowPrimary: cssVar('--btn-shadow-primary-hover'),
      tableHeader: isDark
        ? 'rgba(133, 148, 144, 0.06)'
        : 'rgba(255, 255, 255, 0.50)',
    };

    return {
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: v.primary,
        colorSuccess: v.success,
        colorWarning: v.warning,
        colorError: v.error,
        colorInfo: v.info,
        colorBgBase: v.bgBase,
        colorBgContainer: v.bgContainer,
        colorBgElevated: v.bgElevated,
        colorBgLayout: 'transparent',
        colorBorder: v.border,
        colorBorderSecondary: v.borderSecondary,
        colorText: v.text,
        colorTextSecondary: v.textSecondary,
        colorTextTertiary: v.textTertiary,
        colorTextLightSolid: '#ffffff',
        borderRadius: 8,
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        controlHeight: 36,
        boxShadow: v.shadow,
        boxShadowSecondary: v.shadowSecondary,
      },
      components: {
        Button: {
          controlHeight: 36,
          borderRadius: 8,
          fontWeight: 500,
          primaryShadow: v.btnShadowPrimary,
        },
        Card: {
          borderRadiusLG: 12,
          paddingLG: 20,
          colorBgContainer: v.bgContainer,
        },
        Input: {
          controlHeight: 36,
          borderRadius: 8,
          colorBgContainer: v.bgInput,
          activeBorderColor: v.primary,
        },
        Select: {
          controlHeight: 36,
          borderRadius: 8,
          colorBgContainer: v.bgInput,
          colorBgElevated: v.bgElevated,
        },
        Table: {
          borderRadius: 12,
          colorBgContainer: 'transparent',
          headerBg: v.tableHeader,
          headerColor: v.textSecondary,
          rowHoverBg: v.hover,
          colorBorderSecondary: v.borderSecondary,
        },
        Menu: {
          itemBorderRadius: 8,
          itemMarginInline: 8,
          itemHeight: 36,
          itemBg: 'transparent',
          itemSelectedBg: v.selected,
          itemSelectedColor: v.primary,
          itemColor: v.textSecondary,
          itemHoverColor: v.text,
          itemHoverBg: v.hover,
        },
        Tabs: {
          borderRadius: 8,
        },
        Modal: {
          contentBg: v.bgElevated,
          headerBg: 'transparent',
        },
        Dropdown: {
          colorBgElevated: v.bgElevated,
        },
        Descriptions: {
          colorBgContainer: v.bgContainer,
        },
        Tag: {
          borderRadiusSM: 4,
        },
      },
    };
  // accent triggers DOM class swap which changes CSS vars; re-read them
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, accent]);

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
