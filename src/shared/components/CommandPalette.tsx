import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../api';
import { useThemeStore } from '../../stores/themeStore';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  group: 'command' | 'project';
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projectResults, setProjectResults] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = useThemeStore(s => s.mode === 'dark');

  const defaultCommands: CommandItem[] = [
    { id: 'workspace', label: '前往工作区', description: '/', icon: 'terminal', group: 'command', action: () => { navigate('/'); onClose(); } },
    { id: 'projects', label: '前往项目管理', description: '/projects', icon: 'folder', group: 'command', action: () => { navigate('/projects'); onClose(); } },
    { id: 'settings', label: '前往设置', description: '/settings', icon: 'settings', group: 'command', action: () => { navigate('/settings'); onClose(); } },
    { id: 'git', label: '前往 Git', description: '/git', icon: 'code', group: 'command', action: () => { navigate('/git'); onClose(); } },
    { id: 'new-project', label: '新建项目', description: '创建一个新项目', icon: 'add', group: 'command', action: () => { navigate('/projects'); onClose(); } },
  ];

  const filteredCommands = defaultCommands.filter(
    c => c.label.toLowerCase().includes(query.toLowerCase()) || c.description?.toLowerCase().includes(query.toLowerCase())
  );

  const allItems = query.trim()
    ? [...filteredCommands, ...projectResults]
    : filteredCommands;

  const searchProjects = useCallback(async (q: string) => {
    if (!q.trim()) {
      setProjectResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchApi.search(q);
      const items: CommandItem[] = (data.projects || []).slice(0, 5).map((p: { id: string; name: string; description?: string }) => ({
        id: `proj-${p.id}`,
        label: p.name,
        description: p.description || '项目',
        icon: 'folder_open',
        group: 'project' as const,
        action: () => { navigate(`/projects/${p.id}`); onClose(); },
      }));
      setProjectResults(items);
    } catch {
      setProjectResults([]);
    } finally {
      setLoading(false);
    }
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      setProjectResults([]);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProjects(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchProjects]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      onClose();
    }
  };

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: 'min(20vh, 160px)',
  };

  const panel: React.CSSProperties = {
    width: '100%', maxWidth: 560, maxHeight: 400,
    borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    background: isDark ? 'rgba(13,20,29,0.96)' : 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(30px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
    border: `1px solid ${isDark ? 'rgba(79,219,200,0.18)' : 'rgba(0,107,95,0.18)'}`,
    boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.52)' : '0 24px 64px rgba(0,0,0,0.16)',
  };

  const groupLabel = (_label: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)',
    padding: '8px 14px 4px', userSelect: 'none',
  });

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={panel} onMouseDown={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${isDark ? 'rgba(79,219,200,0.10)' : 'rgba(0,107,95,0.08)'}` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)' }}>search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索命令和项目..."
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 14, color: isDark ? '#e2e8f0' : '#1e293b',
              fontFamily: "'Fira Sans', sans-serif",
            }}
          />
          {loading && <span style={{ fontSize: 11, color: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)' }}>...</span>}
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {allItems.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)' }}>
              未找到结果
            </div>
          )}
          {(() => {
            let globalIndex = -1;
            const groups: { label: string; items: CommandItem[] }[] = [];
            if (filteredCommands.length) groups.push({ label: '命令', items: filteredCommands });
            if (projectResults.length) groups.push({ label: '项目', items: projectResults });
            return groups.map(g => (
              <div key={g.label}>
                <div style={groupLabel(g.label)}>{g.label}</div>
                {g.items.map(item => {
                  globalIndex++;
                  const idx = globalIndex;
                  const selected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', cursor: 'pointer', transition: 'background 0.1s',
                        background: selected ? (isDark ? 'rgba(79,219,200,0.10)' : 'rgba(0,107,95,0.08)') : 'transparent',
                        borderRadius: 6, margin: '0 6px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: selected ? 'var(--md-primary)' : (isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)'), flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#e2e8f0' : '#1e293b' }}>{item.label}</div>
                        {item.description && <div style={{ fontSize: 11, color: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)', marginTop: 1 }}>{item.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px',
          borderTop: `1px solid ${isDark ? 'rgba(79,219,200,0.10)' : 'rgba(0,107,95,0.08)'}`,
          fontSize: 11, color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)',
          fontFamily: "'Fira Code', monospace",
        }}>
          <span>↑↓ 导航</span>
          <span>↵ 选择</span>
          <span>esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
