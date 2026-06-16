import {
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileUnknownOutlined,
  CodeOutlined,
  SettingOutlined,
  FileImageOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import React from 'react';

// ── Language → CodeMirror extension mapping ──

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    json: 'json', jsonc: 'json',
    md: 'markdown', mdx: 'markdown',
    rs: 'rust',
    py: 'python',
    css: 'css',
    scss: 'css', sass: 'css', less: 'css',
    html: 'html', htm: 'html',
    xml: 'xml', svg: 'xml',
    yaml: 'yaml', yml: 'yaml',
    sql: 'sql',
    sh: 'javascript', bash: 'javascript', zsh: 'javascript', // shell → no CM lang, fallback
  };
  return map[ext] || 'text';
}

// ── Theme-aware file icon colors ──

const darkIconColors = {
  folder: '#60a5fa',
  config: '#a6e22e',
  code: '#3178c6',
  docs: '#94a3b8',
  image: '#f59e0b',
  database: '#8b5cf6',
  css: '#61dafb',
  html: '#e34c26',
  unknown: '#64748b',
};

const lightIconColors = {
  folder: '#3b82f6',
  config: '#65a30d',
  code: '#2563eb',
  docs: '#64748b',
  image: '#d97706',
  database: '#7c3aed',
  css: '#0284c7',
  html: '#dc2626',
  unknown: '#64748b',
};

type IconColorKey = keyof typeof darkIconColors;

function getIconColor(key: IconColorKey, isDark: boolean): string {
  return isDark ? darkIconColors[key] : lightIconColors[key];
}

// ── File icon based on extension ──

export function getFileIcon(name: string, isDir: boolean, isOpen?: boolean, isDark = true): React.ReactNode {
  const c = (key: IconColorKey) => getIconColor(key, isDark);

  if (isDir) {
    return isOpen
      ? React.createElement(FolderOpenOutlined, { style: { fontSize: 13, color: c('folder'), flexShrink: 0 } })
      : React.createElement(FolderOutlined, { style: { fontSize: 13, color: c('folder'), flexShrink: 0 } });
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  // Config files
  if (['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'].includes(ext)) {
    return React.createElement(SettingOutlined, { style: { fontSize: 13, color: c('config'), flexShrink: 0 } });
  }
  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'swift', 'dart', 'lua'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: c('code'), flexShrink: 0 } });
  }
  // Markdown / docs
  if (['md', 'mdx', 'txt', 'log'].includes(ext)) {
    return React.createElement(FileTextOutlined, { style: { fontSize: 13, color: c('docs'), flexShrink: 0 } });
  }
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp'].includes(ext)) {
    return React.createElement(FileImageOutlined, { style: { fontSize: 13, color: c('image'), flexShrink: 0 } });
  }
  // Data
  if (['db', 'sqlite', 'sql'].includes(ext)) {
    return React.createElement(DatabaseOutlined, { style: { fontSize: 13, color: c('database'), flexShrink: 0 } });
  }
  // CSS
  if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: c('css'), flexShrink: 0 } });
  }
  // HTML
  if (['html', 'htm', 'xml', 'svg'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: c('html'), flexShrink: 0 } });
  }

  return React.createElement(FileUnknownOutlined, { style: { fontSize: 13, color: c('unknown'), flexShrink: 0 } });
}

// ── Format file size ──

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Get display name from path ──

export function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}
