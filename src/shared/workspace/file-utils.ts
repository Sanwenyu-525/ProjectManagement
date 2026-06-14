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

// ── File icon based on extension ──

export function getFileIcon(name: string, isDir: boolean, isOpen?: boolean): React.ReactNode {
  if (isDir) {
    return isOpen
      ? React.createElement(FolderOpenOutlined, { style: { fontSize: 13, color: '#60a5fa', flexShrink: 0 } })
      : React.createElement(FolderOutlined, { style: { fontSize: 13, color: '#60a5fa', flexShrink: 0 } });
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  // Config files
  if (['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf'].includes(ext)) {
    return React.createElement(SettingOutlined, { style: { fontSize: 13, color: '#a6e22e', flexShrink: 0 } });
  }
  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'swift', 'dart', 'lua'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: '#3178c6', flexShrink: 0 } });
  }
  // Markdown / docs
  if (['md', 'mdx', 'txt', 'log'].includes(ext)) {
    return React.createElement(FileTextOutlined, { style: { fontSize: 13, color: '#94a3b8', flexShrink: 0 } });
  }
  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp'].includes(ext)) {
    return React.createElement(FileImageOutlined, { style: { fontSize: 13, color: '#f59e0b', flexShrink: 0 } });
  }
  // Data
  if (['db', 'sqlite', 'sql'].includes(ext)) {
    return React.createElement(DatabaseOutlined, { style: { fontSize: 13, color: '#8b5cf6', flexShrink: 0 } });
  }
  // CSS
  if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: '#61dafb', flexShrink: 0 } });
  }
  // HTML
  if (['html', 'htm', 'xml', 'svg'].includes(ext)) {
    return React.createElement(CodeOutlined, { style: { fontSize: 13, color: '#e34c26', flexShrink: 0 } });
  }

  return React.createElement(FileUnknownOutlined, { style: { fontSize: 13, color: '#64748b', flexShrink: 0 } });
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
