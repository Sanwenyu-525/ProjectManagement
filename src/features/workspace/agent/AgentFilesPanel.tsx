import { useState, useCallback } from 'react';
import { Spin } from 'antd';
import { useFileTree } from '../../../hooks/useFiles';
import { filesApi } from '../../../api';
import type { FileTreeNode } from '../../../api/types';

interface AgentFilesPanelProps {
  repoPath: string | null;
}

export default function AgentFilesPanel({ repoPath }: AgentFilesPanelProps) {
  const { data: tree, isLoading } = useFileTree(repoPath ?? undefined, 3);

  if (!repoPath) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)' }}>
          folder_off
        </span>
        <p style={styles.emptyText}>No workspace path set.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={styles.empty}>
        <Spin size="small" />
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)' }}>
          folder_open
        </span>
        <p style={styles.emptyText}>Empty directory.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pathBar}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
          folder
        </span>
        <span style={styles.pathText} title={repoPath}>
          {repoPath.split(/[/\\]/).pop() ?? repoPath}
        </span>
      </div>
      <div style={styles.tree}>
        {tree.map(node => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  const handleClick = useCallback(() => {
    if (node.isDir) {
      setExpanded(prev => !prev);
    } else {
      filesApi.openInIde(node.path).catch(() => {});
    }
  }, [node.isDir, node.path]);

  const icon = node.isDir
    ? (expanded ? 'folder_open' : 'folder')
    : fileIcon(node.extension);

  return (
    <div>
      <button
        onClick={handleClick}
        style={{
          ...styles.item,
          paddingLeft: 8 + depth * 14,
        }}
        title={node.path}
      >
        {node.isDir && (
          <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginRight: 2 }}>
            {expanded ? 'expand_more' : 'chevron_right'}
          </span>
        )}
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: iconColor(node), marginRight: 6 }}>
          {icon}
        </span>
        <span style={styles.name}>{node.name}</span>
        {!node.isDir && node.size != null && (
          <span style={styles.size}>{formatSize(node.size)}</span>
        )}
      </button>
      {node.isDir && expanded && node.children?.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function fileIcon(ext?: string): string {
  if (!ext) return 'description';
  const map: Record<string, string> = {
    ts: 'code', tsx: 'code', js: 'code', jsx: 'code',
    rs: 'code', go: 'code', py: 'code', java: 'code',
    json: 'data_object', yaml: 'data_object', yml: 'data_object', toml: 'data_object',
    md: 'markdown', txt: 'article',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
    html: 'html', css: 'style',
    sql: 'database',
    sh: 'terminal', bat: 'terminal', ps1: 'terminal',
  };
  return map[ext.toLowerCase()] ?? 'description';
}

function iconColor(node: FileTreeNode): string {
  if (node.isDir) return 'var(--md-primary)';
  const ext = node.extension?.toLowerCase();
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext ?? '')) return '#3B82F6';
  if (['rs'].includes(ext ?? '')) return '#DEA584';
  if (['json', 'yaml', 'yml', 'toml'].includes(ext ?? '')) return '#F59E0B';
  if (['md'].includes(ext ?? '')) return '#6B7280';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) return '#EC4899';
  return 'var(--md-on-surface-variant)';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pathBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  pathText: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tree: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '3px 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    color: 'var(--md-on-surface)',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  size: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    marginLeft: 8,
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: {
    margin: '8px 0 0',
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },
};
