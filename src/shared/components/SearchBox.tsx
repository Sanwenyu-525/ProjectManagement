/* src/shared/components/SearchBox.tsx */

import { useState, useRef, useEffect } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../api';
import ProjectIcon from '../ProjectIcon';
import { parseTechStack } from '../../lib/normalize';

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

export default function SearchBox() {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
        data.projects.forEach((p: any) => {
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
        data.tasks.forEach((t: any) => {
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
        data.documents.forEach((d: any) => {
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
    switch (type) {
      case 'project': return '#22c55e';
      case 'task': return '#f59e0b';
      case 'document': return '#3b82f6';
      default: return '#6b7a99';
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
      <div
        tabIndex={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.12) 100%), rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: `1px solid ${focused ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.35)'}`,
          borderRadius: 8,
          padding: '8px 16px',
          height: 36,
          minWidth: 0,
          boxShadow: focused
            ? 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 20px rgba(34, 197, 94, 0.15)'
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 4px 12px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.18) 100%), rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          if (!focused) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.12) 100%), rgba(255, 255, 255, 0.25)';
          }
        }}
        onFocus={() => {
          setFocused(true);
          inputRef.current?.focus();
        }}
        onBlur={() => setFocused(false)}
        onClick={() => inputRef.current?.focus()}
      >
        <SearchOutlined
          style={{
            color: focused ? '#22c55e' : '#9eadc0',
            fontSize: 14,
            transition: 'color 0.3s ease',
          }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              handleSearch(query);
            }
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#1a1f36',
            fontSize: 13,
            flex: 1,
            outline: 'none',
            fontFamily: "'Fira Sans', sans-serif",
          }}
          placeholder="搜索项目、任务、文档..."
        />
        <kbd style={{
          fontSize: 10,
          color: '#9eadc0',
          background: 'rgba(255, 255, 255, 0.15)',
          padding: '2px 6px',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontFamily: "'Fira Code', monospace",
        }}>
          ⌘K
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
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          padding: results.length === 0 ? 16 : 8,
          maxHeight: 320,
          overflow: 'auto',
          zIndex: 100,
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 16, color: '#9eadc0', fontSize: 13 }}>
              搜索中...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: '#9eadc0', fontSize: 13 }}>
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
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
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
                  color: '#1a1f36',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {result.title}
                </div>
                {result.projectName && result.type !== 'project' && (
                  <div style={{ fontSize: 11, color: '#9eadc0', marginTop: 2 }}>
                    {result.projectName}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 11,
                color: '#9eadc0',
                background: 'rgba(0, 0, 0, 0.04)',
                padding: '2px 8px',
                borderRadius: 4,
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
