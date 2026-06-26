import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined } from '@ant-design/icons';
import { searchApi } from '../../api';
import { filesApi } from '../../api/terminal';
import { useThemeStore } from '../../stores/themeStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { COMMANDS, getCommandsByCategory, CATEGORY_LABELS } from '../../lib/commands';
import { fuzzyMatch } from '../../lib/fuzzyMatch';
import { getRecentCommandIds, recordCommandUse } from '../../lib/recentCommands';
import { fileIcon, sortByRelevance } from './searchUtils';
import type { ContentSearchMatch } from '../../api/types';
import type { TaskWithProject, DocumentWithProject } from '../../types';

interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  group: 'command' | 'project' | 'task' | 'document' | 'file' | 'content';
  action: () => void;
  shortcut?: string;
}

export default function SearchBox() {
  const navigate = useNavigate();
  const isDark = useThemeStore(s => s.mode === 'dark');
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projectResults, setProjectResults] = useState<DropdownItem[]>([]);
  const [taskResults, setTaskResults] = useState<DropdownItem[]>([]);
  const [docResults, setDocResults] = useState<DropdownItem[]>([]);
  const [fileResults, setFileResults] = useState<DropdownItem[]>([]);
  const [contentResults, setContentResults] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setProjectResults([]);
    setTaskResults([]);
    setDocResults([]);
    setFileResults([]);
    setContentResults([]);
  }, []);

  // Build commands from registry, wrapping actions with record + close
  const commands: DropdownItem[] = useMemo(() =>
    COMMANDS
      .filter(c => c.id !== 'palette')
      .map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        icon: c.icon,
        group: 'command' as const,
        shortcut: c.shortcut,
        action: () => {
          recordCommandUse(c.id);
          c.action();
          close();
        },
      })),
    [close],
  );

  const q = query.trim();
  const qLower = q.toLowerCase();

  // 解析 "in: " 前缀（in: + 空格）触发内容搜索
  // "in:test" 走文件名搜索，"in: test" 走内容搜索
  const inPrefix = qLower.indexOf('in: ');
  const isContentMode = inPrefix === 0;
  const contentTerm = isContentMode ? q.slice(4) : '';

  // Fuzzy-filter commands by query
  const filteredCommands = isContentMode ? [] : (q
    ? commands
        .map(c => ({ item: c, match: fuzzyMatch(q, c.label) ?? fuzzyMatch(q, c.description ?? '') }))
        .filter((x): x is { item: DropdownItem; match: { score: number; indices: number[] } } => x.match !== null)
        .sort((a, b) => b.match.score - a.match.score)
        .map(x => x.item)
    : commands);

  // Recent commands (shown when query is empty)
  const recentItems: DropdownItem[] = [];
  if (!q && !isContentMode) {
    const recentIds = getRecentCommandIds();
    for (const id of recentIds) {
      const cmd = commands.find(c => c.id === id);
      if (cmd) recentItems.push(cmd);
    }
  }

  const allItems = q
    ? (isContentMode
        ? contentResults
        : [...filteredCommands, ...projectResults, ...taskResults, ...docResults, ...fileResults])
    : [...recentItems, ...filteredCommands];

  // ── 分层搜索 ──

  /** 3+ 字符：搜索文件名 */
  const searchFiles = useCallback(async (term: string) => {
    if (term.length < 3) { setFileResults([]); return; }
    try {
      const files = sortByRelevance(await filesApi.searchAcrossProjects(term, 8));
      setFileResults(files.map(f => ({
        id: `file-${f.path}`, label: f.name,
        description: f.path,
        icon: fileIcon(f.extension), group: 'file' as const,
        action: () => {
          const store = useWorkspaceStore.getState();
          store.selectFile(f.path, 'single');
          store.requestOpenFile(f.path);
          navigate('/workspace');
          close();
        },
      })));
    } catch { setFileResults([]); }
  }, [navigate, close]);

  // 项目 + 内容搜索（合并为一次 debounce，in: 模式下跳过）
  useEffect(() => {
    if (isContentMode) {
      setProjectResults([]); setTaskResults([]); setDocResults([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      if (!q) { setProjectResults([]); setTaskResults([]); setDocResults([]); return; }
      setLoading(true);
      try {
        const data = await searchApi.search(q);
        setProjectResults((data.projects || []).slice(0, 5).map((p: { id: string; name: string; description?: string }) => ({
          id: `proj-${p.id}`, label: p.name,
          description: p.description || '项目',
          icon: 'folder_open', group: 'project' as const,
          action: () => { navigate(`/projects/${p.id}`); close(); },
        })));
        if (q.length >= 2) {
          setTaskResults((data.tasks || []).slice(0, 5).map((t: TaskWithProject) => ({
            id: `task-${t.id}`, label: t.title,
            description: `${t.projectName} · ${t.status}`,
            icon: 'task_alt', group: 'task' as const,
            action: () => { navigate(`/projects/${t.projectId}`); close(); },
          })));
          setDocResults((data.documents || []).slice(0, 3).map((d: DocumentWithProject) => ({
            id: `doc-${d.id}`, label: d.title,
            description: `${d.projectName} · ${d.type}`,
            icon: 'article', group: 'document' as const,
            action: () => { navigate(`/projects/${d.projectId}`); close(); },
          })));
        } else {
          setTaskResults([]);
          setDocResults([]);
        }
      } catch { setProjectResults([]); setTaskResults([]); setDocResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [q, isContentMode, navigate, close]);

  // 文件搜索（独立 debounce，3+ 字符才触发，in: 模式下跳过）
  useEffect(() => {
    if (isContentMode) { setFileResults([]); return; }
    if (fileDebounce.current) clearTimeout(fileDebounce.current);
    fileDebounce.current = setTimeout(() => searchFiles(q), 300);
    return () => { if (fileDebounce.current) clearTimeout(fileDebounce.current); };
  }, [q, isContentMode, searchFiles]);

  // 内容搜索（in: 前缀触发）
  useEffect(() => {
    if (!isContentMode) { setContentResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      if (contentTerm.length < 2) { setContentResults([]); return; }
      setLoading(true);
      try {
        const matches: ContentSearchMatch[] = await filesApi.searchContent(contentTerm, 12);
        setContentResults(matches.map((m, i) => ({
          id: `content-${m.filePath}-${m.lineNumber}-${i}`, label: m.fileName,
          description: `L${m.lineNumber}: ${m.lineText}`,
          icon: fileIcon(m.extension), group: 'content' as const,
          action: () => {
            const store = useWorkspaceStore.getState();
            store.selectFile(m.filePath);
            store.requestOpenFile(m.filePath);
            navigate('/workspace');
            close();
          },
        })));
      } catch { setContentResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [contentTerm, isContentMode, navigate, close]);

  useEffect(() => { setSelectedIndex(0); }, [q]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Ctrl+K to focus input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (composingRef.current) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      allItems[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        // First Esc: clear query, keep dropdown open
        setQuery('');
        setSelectedIndex(0);
      } else {
        // Second Esc: close dropdown
        close();
      }
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
  };

  const showDropdown = open && (allItems.length > 0 || loading);

  // ── Styles ──

  const inputBox: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: hovered || focused || open
      ? 'var(--md-surface-container-high)' : 'var(--md-surface-container)',
    border: `1px solid ${focused || open ? 'var(--md-primary)' : hovered ? 'var(--md-outline)' : 'var(--border)'}`,
    borderRadius: showDropdown ? '8px 8px 0 0' : 8,
    padding: '0 12px', height: 36, minWidth: 0, cursor: 'text',
    boxSizing: 'border-box', transition: 'all 0.2s ease',
    boxShadow: focused || open ? '0 0 0 2px rgba(0,107,95,0.14)' : 'none',
  };

  const dropdown: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
    maxHeight: 400, overflowY: 'auto', overflowX: 'hidden',
    background: isDark ? 'rgba(13,20,29,0.97)' : 'rgba(255,255,255,0.97)',
    backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
    border: `1px solid ${isDark ? 'rgba(79,219,200,0.18)' : 'rgba(0,107,95,0.18)'}`,
    borderTop: 'none',
    borderRadius: '0 0 14px 14px',
    boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.14)',
  };

  const groupTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)',
    padding: '8px 14px 4px', userSelect: 'none',
  };

  // 分组顺序
  const groups: { label: string; items: DropdownItem[] }[] = [];
  if (recentItems.length) groups.push({ label: '最近使用', items: recentItems });

  if (q) {
    // When searching, show filtered commands as a single group
    if (filteredCommands.length) groups.push({ label: '命令', items: filteredCommands });
  } else {
    // When not searching, group commands by category
    const catMap = getCommandsByCategory();
    for (const [cat, catCmds] of catMap) {
      const items = catCmds
        .map(c => commands.find(cmd => cmd.id === c.id))
        .filter((x): x is DropdownItem => !!x);
      if (items.length) groups.push({ label: CATEGORY_LABELS[cat], items });
    }
  }

  if (projectResults.length) groups.push({ label: '项目', items: projectResults });
  if (taskResults.length) groups.push({ label: '任务', items: taskResults });
  if (docResults.length) groups.push({ label: '文档', items: docResults });
  if (fileResults.length) groups.push({ label: '文件', items: fileResults });
  if (contentResults.length) groups.push({ label: '内容', items: contentResults });

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>
      {/* Input area */}
      <div
        style={inputBox}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <SearchOutlined
          style={{
            color: focused || open ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
            fontSize: 14, transition: 'color 0.2s ease', flexShrink: 0,
          }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={e => {
            composingRef.current = false;
            handleQueryChange(e.currentTarget.value);
          }}
          placeholder="搜索命令、项目或文件...  in: 搜索内容"
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
            fontFamily: "'Fira Sans', sans-serif", minWidth: 0,
          }}
        />
        {loading && (
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${isDark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)'}`,
            borderTopColor: 'var(--md-primary)',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <span
            onClick={(e) => { e.stopPropagation(); setQuery(''); setSelectedIndex(0); inputRef.current?.focus(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              color: 'var(--md-on-surface-variant)', fontSize: 14,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </span>
        )}
        {!open && (
          <kbd style={{
            fontSize: 10, color: 'var(--md-on-surface-variant)',
            background: 'var(--md-surface-container-high)',
            padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border)',
            fontFamily: "'Fira Code', monospace", flexShrink: 0,
          }}>
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={dropdown}>
          <div ref={listRef} style={{ padding: '6px 0' }}>
            {allItems.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                未找到结果
              </div>
            )}
            {groups.map(g => {
              // 计算本组在全局列表中的起始 index
              const startIndex = groups
                .slice(0, groups.indexOf(g))
                .reduce((sum, grp) => sum + grp.items.length, 0);
              return (
                <div key={g.label}>
                  <div style={groupTitle}>{g.label}</div>
                  {g.items.map((item, localIdx) => {
                    const idx = startIndex + localIdx;
                    const selected = idx === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onMouseDown={e => { e.preventDefault(); item.action(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 14px', cursor: 'pointer',
                          borderRadius: 6, margin: '0 6px',
                          ...(selected
                            ? { background: isDark ? 'rgba(79,219,200,0.10)' : 'rgba(0,107,95,0.08)' }
                            : {}),
                        }}
                        onMouseEnter={e => {
                          if (!selected) e.currentTarget.style.background = isDark ? 'rgba(79,219,200,0.06)' : 'rgba(0,107,95,0.04)';
                        }}
                        onMouseLeave={e => {
                          if (!selected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span className="material-symbols-outlined" style={{
                          fontSize: 18,
                          color: selected ? 'var(--md-primary)' : 'var(--color-text-tertiary)',
                          flexShrink: 0,
                        }}>
                          {item.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 500,
                            color: isDark ? '#e2e8f0' : '#1e293b',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.label}
                          </div>
                          {item.description && (
                            <div style={{
                              fontSize: 11,
                              color: 'var(--color-text-tertiary)',
                              marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <kbd style={{
                            fontSize: 10, color: 'var(--md-on-surface-variant)',
                            background: 'var(--md-surface-container-high)',
                            padding: '1px 5px', borderRadius: 3,
                            border: '1px solid var(--border)',
                            fontFamily: "'Fira Code', monospace", flexShrink: 0,
                          }}>
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px',
            borderTop: '1px solid var(--divider)',
            fontSize: 11, color: 'var(--color-text-tertiary)',
            fontFamily: "'Fira Code', monospace",
          }}>
            <span>↑↓ 导航</span>
            <span>↵ 选择</span>
            <span>esc 关闭</span>
          </div>
        </div>
      )}
    </div>
  );
}
