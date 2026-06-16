/* src/shared/components/SearchBox.tsx */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MoonOutlined, SearchOutlined, SunOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { isEnterCommit } from '@/lib/keyboard';
import { searchApi } from '../../api';
import ProjectIcon from '../ProjectIcon';
import { parseTechStack } from '../../lib/normalize';
import { useThemeStore } from '../../stores/themeStore';
import { getThemeColors } from '../../lib/themeColors';

interface SearchResult {
  type: 'project' | 'task' | 'document' | 'member';
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  iconType?: string;
  iconUrl?: string | null;
  iconColor?: string | null;
  techStack?: string[];
}

interface ThemeColors {
  inputBg: string;
  inputBgHover: string;
  border: string;
  borderFocus: string;
  borderHover: string;
  text: string;
  icon: string;
  iconFocus: string;
  placeholder: string;
  kbdBg: string;
  kbdBorder: string;
  kbdText: string;
  boxShadow: string;
  boxShadowFocus: string;
  boxShadowHover: string;
  dropdownBg: string;
  dropdownBorder: string;
  dropdownShadow: string;
  resultHover: string;
  resultText: string;
  resultMeta: string;
  emptyText: string;
  loadingText: string;
}

function buildTheme(isDark: boolean): ThemeColors {
  const tc = getThemeColors();
  if (isDark) {
    return {
      inputBg: tc.bgCard,
      inputBgHover: 'rgba(45,212,191,0.08)',
      border: tc.border,
      borderFocus: 'rgba(45,212,191,0.50)',
      borderHover: 'rgba(45,212,191,0.30)',
      text: tc.text,
      icon: tc.textTertiary,
      iconFocus: tc.accent,
      placeholder: tc.textMuted,
      kbdBg: 'rgba(148,163,184,0.08)',
      kbdBorder: tc.border,
      kbdText: tc.textTertiary,
      boxShadow: '0 2px 10px rgba(0,0,0,0.24)',
      boxShadowFocus: `0 0 0 3px rgba(45,212,191,0.14), 0 8px 24px rgba(0,0,0,0.32)`,
      boxShadowHover: '0 8px 22px rgba(0,0,0,0.28)',
      dropdownBg: 'rgba(13,20,29,0.96)',
      dropdownBorder: tc.border,
      dropdownShadow: '0 16px 44px rgba(0,0,0,0.48)',
      resultHover: `rgba(45,212,191,0.10)`,
      resultText: tc.text,
      resultMeta: tc.textTertiary,
      emptyText: tc.textMuted,
      loadingText: tc.textMuted,
    };
  }
  return {
    inputBg: `linear-gradient(135deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.24) 100%), ${tc.bgSurface}`,
    inputBgHover: `linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.32) 100%), rgba(255,255,255,0.48)`,
    border: 'rgba(255,255,255,0.52)',
    borderFocus: `rgba(20,184,166,0.52)`,
    borderHover: `rgba(20,184,166,0.34)`,
    text: tc.text,
    icon: tc.textTertiary,
    iconFocus: tc.primary,
    placeholder: tc.textMuted,
    kbdBg: 'rgba(255,255,255,0.30)',
    kbdBorder: 'rgba(255,255,255,0.46)',
    kbdText: tc.textTertiary,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.72), 0 4px 14px ${tc.border}`,
    boxShadowFocus: `inset 0 1px 0 rgba(255,255,255,0.76), 0 0 0 3px rgba(20,184,166,0.14), 0 8px 24px ${tc.border}`,
    boxShadowHover: `inset 0 1px 0 rgba(255,255,255,0.76), 0 8px 22px ${tc.border}`,
    dropdownBg: 'rgba(255,255,255,0.88)',
    dropdownBorder: 'rgba(255,255,255,0.58)',
    dropdownShadow: `0 16px 44px ${tc.border}, inset 0 1px 0 rgba(255,255,255,0.72)`,
    resultHover: `rgba(20,184,166,0.10)`,
    resultText: tc.text,
    resultMeta: tc.textTertiary,
    emptyText: tc.textMuted,
    loadingText: tc.textMuted,
  };
}

export default function SearchBox() {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const isDark = useThemeStore(s => s.mode === 'dark');
  const toggleTheme = useThemeStore(s => s.toggle);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const theme = useMemo(() => buildTheme(isDark), [isDark]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setShowResults(true);

    try {
      const data = await searchApi.search(value);
      const searchResults: SearchResult[] = [];

      if (data.projects) {
        data.projects.forEach((p) => {
          searchResults.push({
            type: 'project',
            id: p.id,
            title: p.name,
            description: p.description,
            projectName: p.name,
            iconType: p.iconType,
            iconUrl: p.iconUrl,
            iconColor: p.iconColor,
            techStack: parseTechStack(p.techStack),
          });
        });
      }

      if (data.tasks) {
        data.tasks.forEach((t) => {
          searchResults.push({
            type: 'task',
            id: t.id,
            title: t.title,
            description: t.description,
            projectId: t.projectId,
            projectName: t.projectName,
          });
        });
      }

      if (data.documents) {
        data.documents.forEach((d) => {
          searchResults.push({
            type: 'document',
            id: d.id,
            title: d.title,
            description: d.content?.substring(0, 100),
            projectId: d.projectId,
            projectName: d.projectName,
          });
        });
      }

      setResults(searchResults.slice(0, 10));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDebounced = useCallback((value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSearch(value);
    }, 200);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'project') {
      navigate(`/projects/${result.id}`);
    } else if (result.type === 'task' && result.projectId) {
      navigate(`/projects/${result.projectId}?tab=tasks`);
    } else if (result.type === 'document' && result.projectId) {
      navigate(`/projects/${result.projectId}?tab=documents`);
    }
    setShowResults(false);
    setQuery('');
  };

  const getTypeColor = (type: string) => {
    const c = getThemeColors();
    switch (type) {
      case 'project': return c.primary;
      case 'task': return c.amber;
      case 'document': return c.info;
      default: return c.textTertiary;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: hovered || focused ? theme.inputBgHover : theme.inputBg,
          border: `1px solid ${focused ? theme.borderFocus : hovered ? theme.borderHover : theme.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          height: 36,
          minWidth: 0,
          boxShadow: focused ? theme.boxShadowFocus : hovered ? theme.boxShadowHover : theme.boxShadow,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          inputRef.current?.focus();
        }}
      >
        <SearchOutlined
          style={{
            color: focused ? theme.iconFocus : theme.icon,
            fontSize: 14,
            transition: 'color 0.3s ease',
          }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearchDebounced(e.target.value);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setQuery(e.currentTarget.value);
            handleSearchDebounced(e.currentTarget.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (composingRef.current) return;
            if (isEnterCommit(e) && query.trim()) {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              handleSearch(query);
            }
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-primary, #1e293b)',
            fontSize: 13,
            flex: 1,
            outline: 'none',
            fontFamily: "'Fira Sans', sans-serif",
          }}
          placeholder="搜索项目、任务、文档..."
        />
        {/* Theme toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
          title={isDark ? '切换到浅色主题' : '切换到深色主题'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: theme.icon,
            cursor: 'pointer',
            padding: 0,
            fontSize: 11,
            flexShrink: 0,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = theme.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = theme.icon; }}
        >
          {isDark ? <SunOutlined /> : <MoonOutlined />}
        </button>
        <kbd style={{
          fontSize: 10,
          color: theme.kbdText,
          background: theme.kbdBg,
          padding: '2px 6px',
          borderRadius: 4,
          border: `1px solid ${theme.kbdBorder}`,
          fontFamily: "'Fira Code', monospace",
          flexShrink: 0,
        }}>
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </div>

      {/* Search Results Dropdown */}
      {showResults && query.trim() && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 8,
          background: theme.dropdownBg,
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          border: `1px solid ${theme.dropdownBorder}`,
          boxShadow: theme.dropdownShadow,
          padding: results.length === 0 ? 16 : 8,
          maxHeight: 320,
          overflow: 'auto',
          zIndex: 100,
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: theme.loadingText, fontSize: 13 }}>
              搜索中...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: theme.emptyText, fontSize: 13 }}>
              未找到匹配结果
            </div>
          )}

          {!loading && results.map((result, index) => (
            <div
              key={index}
              onClick={() => handleResultClick(result)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.resultHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {result.type === 'project' ? (
                <ProjectIcon
                  name={result.title}
                  iconType={result.iconType}
                  iconUrl={result.iconUrl}
                  iconColor={result.iconColor}
                  techStack={result.techStack}
                  size={32}
                  style={{ flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: getTypeColor(result.type),
                  flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: theme.resultText,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {result.title}
                </div>
                {result.projectName && result.type !== 'project' && (
                  <div style={{ fontSize: 11, color: theme.resultMeta, marginTop: 2 }}>
                    {result.projectName}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 11,
                color: theme.resultMeta,
                flexShrink: 0,
              }}>
                {result.type === 'project' && '项目'}
                {result.type === 'task' && '任务'}
                {result.type === 'document' && '文档'}
                {result.type === 'member' && '成员'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
