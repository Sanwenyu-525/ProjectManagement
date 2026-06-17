import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from 'antd';
import { useThemeStore } from '../../../stores/themeStore';
import { documentsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useProjects, useDocuments } from '../../../hooks/useProjects';
import { useSearch } from '../../../hooks/useSearch';
import type { Document } from '../../../types';

// ── Types ──
interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
}

type DocSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'code'; code: string }
  | { type: 'callout'; title: string; text: string };

const TYPE_LABELS: Record<string, string> = {
  Doc: '文档',
  Note: '笔记',
  README: 'README',
  API: 'API 文档',
  Architecture: '架构设计',
};

function parseDocumentContent(content: string): DocSection[] {
  const sections: DocSection[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'code', code: codeLines.join('\n') });
      i++; // skip closing ```
    } else if (/^> /.test(line)) {
      sections.push({ type: 'callout', title: '提示', text: line.replace(/^> /, '') });
      i++;
    } else if (/^#{1,3} /.test(line)) {
      sections.push({ type: 'heading', text: line.replace(/^#{1,3} /, '') });
      i++;
    } else if (line.trim()) {
      sections.push({ type: 'paragraph', text: line });
      i++;
    } else {
      i++;
    }
  }
  return sections;
}

function buildDocumentTree(documents: Document[]): TreeNode[] {
  const groups: Record<string, Document[]> = {};
  for (const doc of documents) {
    const label = TYPE_LABELS[doc.type] || doc.type;
    (groups[label] ??= []).push(doc);
  }
  return Object.entries(groups).map(([label, docs]) => ({
    id: `folder-${label}`,
    label,
    type: 'folder' as const,
    children: docs.map(d => ({ id: d.id, label: d.title, type: 'file' as const })),
  }));
}

// ── Sub-components ──

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>
      {isOpen ? 'folder_open' : 'folder'}
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: 16,
        transition: 'transform 0.15s ease',
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      chevron_right
    </span>
  );
}

function TreeItem({ node, depth, expanded, onToggle, selected, onSelect, isDark }: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  isDark: boolean;
}) {
  const isFolder = node.type === 'folder';
  const isOpen = expanded.has(node.id);
  const isSelected = selected === node.id;

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    paddingLeft: depth * 16 + 8,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: isFolder ? 12 : 13,
    fontFamily: isFolder ? 'var(--font-label)' : 'var(--font-sans)',
    fontWeight: isFolder ? 500 : 400,
    color: isSelected ? 'var(--md-primary)' : isFolder ? (isDark ? '#b0bec5' : 'var(--md-on-surface-variant)') : 'var(--md-on-surface-variant)',
    background: isSelected
      ? (isDark ? 'rgba(20,184,166,0.12)' : 'var(--md-surface-container-high)')
      : 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.15s, color 0.15s',
    lineHeight: '18px',
  };

  const handleClick = () => {
    if (isFolder) onToggle(node.id);
    else onSelect(node.id);
  };

  return (
    <>
      <button
        style={baseStyle}
        onClick={handleClick}
        onMouseEnter={e => {
          if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'var(--md-surface-container-low)';
        }}
        onMouseLeave={e => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        {isFolder && <ChevronIcon expanded={isOpen} />}
        {isFolder ? (
          <FolderIcon isOpen={isOpen} />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 16 }}>article</span>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </span>
      </button>
      {isFolder && isOpen && node.children?.map(child => (
        <TreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selected={selected}
          onSelect={onSelect}
          isDark={isDark}
        />
      ))}
    </>
  );
}

function CodeBlock({ code, isDark }: { code: string; isDark: boolean }) {
  return (
    <div style={{
      position: 'relative',
      background: isDark ? '#1a2332' : '#0d1b2a',
      borderRadius: 8,
      padding: 16,
      margin: '16px 0',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      <button
        style={{
          position: 'absolute', top: 8, right: 8,
          padding: 4, background: 'rgba(255,255,255,0.08)',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => navigator.clipboard.writeText(code)}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
      </button>
      <pre style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: '18px',
        color: '#e2e8f0',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Main Component ──

export default function KnowledgeCenterPage() {
  const isDark = useThemeStore(s => s.mode === 'dark');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching via React Query
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const projectId = projects?.[0]?.id;
  const { data: documents = [], isLoading: docsLoading } = useDocuments(projectId);
  const { data: searchResults } = useSearch(searchQuery);

  // Active document: use cache from list if available, otherwise fetch
  const activeDocId = selected && !selected.startsWith('folder-') ? selected : undefined;
  const cachedDoc = useMemo(
    () => documents.find(d => d.id === activeDocId),
    [documents, activeDocId],
  );
  const { data: fetchedDoc } = useQuery({
    queryKey: queryKeys.documents.one(activeDocId!),
    queryFn: () => documentsApi.getById(activeDocId!),
    enabled: !!activeDocId && !cachedDoc,
  });
  const activeDoc = cachedDoc ?? fetchedDoc ?? null;

  // Derived tree
  const knowledgeTree = useMemo(() => buildDocumentTree(documents), [documents]);
  const loading = projectsLoading || docsLoading;

  // Auto-select first document once loaded
  useEffect(() => {
    if (initialized || loading || !documents.length || !knowledgeTree.length) return;
    if (knowledgeTree.length > 0 && knowledgeTree[0].children?.length) {
      const firstFileId = knowledgeTree[0].children[0].id;
      setExpanded(new Set([knowledgeTree[0].id]));
      setSelected(firstFileId);
    }
    setInitialized(true);
  }, [loading, documents, knowledgeTree, initialized]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sections: DocSection[] = activeDoc ? parseDocumentContent(activeDoc.content) : [];
  const docType = activeDoc ? (TYPE_LABELS[activeDoc.type] || activeDoc.type) : '';
  const updatedAgo = activeDoc ? (() => {
    const diffMs = Date.now() - new Date(activeDoc.updatedAt).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    return diffMin < 1 ? '刚刚' : diffMin < 60 ? `${diffMin} 分钟前` : diffMin < 1440 ? `${Math.floor(diffMin / 60)} 小时前` : `${Math.floor(diffMin / 1440)} 天前`;
  })() : '';

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* ── Left Pane: Knowledge Tree ── */}
      <aside style={{
        width: 280,
        flexShrink: 0,
        borderRight: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
        background: isDark ? 'var(--md-surface)' : 'var(--md-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)', margin: 0,
            letterSpacing: '-0.01em',
          }}>
            知识库
          </h2>
          <button style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 6,
            background: 'transparent', border: 'none',
            color: 'var(--md-on-surface-variant)', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'var(--md-surface-container-low)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_box</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 14px' }}>
          <Input
            prefix={<span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>search</span>}
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
            size="small"
            style={{
              borderRadius: 8,
              background: isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-low)',
            }}
          />
        </div>

        {/* Tree / Search Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {searchQuery && searchResults ? (
            /* Search Results */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', padding: '4px 8px', fontFamily: 'var(--font-label)' }}>
                搜索结果 ({(searchResults.documents?.length || 0) + (searchResults.projects?.length || 0) + (searchResults.tasks?.length || 0)})
              </div>
              {searchResults.documents?.map((doc: { id: string; title: string; type: string; projectName?: string }) => (
                <div
                  key={doc.id}
                  onClick={() => setSelected(doc.id)}
                  style={{
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                    background: selected === doc.id ? (isDark ? 'var(--md-primary-container)' : 'rgba(0,107,95,0.08)') : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (selected !== doc.id) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'var(--md-surface-container-low)'; }}
                  onMouseLeave={e => { if (selected !== doc.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 13, color: 'var(--md-on-surface)', fontWeight: 500 }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
                    {TYPE_LABELS[doc.type] || doc.type}
                    {doc.projectName && <span> · {doc.projectName}</span>}
                  </div>
                </div>
              ))}
              {searchResults.projects?.map((proj: { id: string; name: string }) => (
                <div key={`proj-${proj.id}`} style={{ padding: '6px 8px', borderRadius: 6, fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>folder</span>
                  {proj.name}
                </div>
              ))}
              {(!searchResults.documents?.length && !searchResults.projects?.length && !searchResults.tasks?.length) && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 13 }}>
                  无匹配结果
                </div>
              )}
            </div>
          ) : loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 13 }}>
              加载中...
            </div>
          ) : knowledgeTree.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 13 }}>
              暂无文档
            </div>
          ) : (
            knowledgeTree.map(node => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                selected={selected}
                onSelect={setSelected}
                isDark={isDark}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Center Pane: Document Viewer ── */}
      <section style={{
        flex: 1,
        overflowY: 'auto',
        background: isDark ? 'var(--md-background)' : '#ffffff',
      }}>
        {!activeDoc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--md-on-surface-variant)' }}>
            {loading ? '加载中...' : '选择一个文档查看'}
          </div>
        ) : (
          <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 48px' }}>
            {/* Breadcrumb */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500,
              color: 'var(--md-on-surface-variant)', marginBottom: 16,
              letterSpacing: '0.02em',
            }}>
              <span>{docType}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              <span style={{ color: 'var(--md-on-surface)' }}>{activeDoc.title}</span>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 32, fontWeight: 600, color: 'var(--md-on-surface)',
              lineHeight: '40px', letterSpacing: '-0.02em', margin: '0 0 16px',
            }}>
              {activeDoc.title}
            </h1>

            {/* Meta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              fontSize: 13, color: 'var(--md-on-surface-variant)', marginBottom: 32,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                <span>最后更新 {updatedAgo}</span>
              </div>
              <span style={{
                padding: '2px 10px', borderRadius: 999,
                background: isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)',
                fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500,
                color: 'var(--md-on-surface)', letterSpacing: '0.02em',
              }}>
                {docType}
              </span>
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sections.map((section, i) => {
              if (section.type === 'paragraph') {
                return (
                  <p key={i} style={{
                    fontSize: 14, lineHeight: '22px', color: 'var(--md-on-surface-variant)',
                    margin: 0,
                  }}>
                    {section.text}
                  </p>
                );
              }
              if (section.type === 'heading') {
                return (
                  <h2 key={i} style={{
                    fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)',
                    lineHeight: '24px', letterSpacing: '-0.01em',
                    margin: '28px 0 8px',
                    paddingBottom: 10,
                    borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
                  }}>
                    {section.text}
                  </h2>
                );
              }
              if (section.type === 'code') {
                return <CodeBlock key={i} code={section.code} isDark={isDark} />;
              }
              if (section.type === 'callout') {
                return (
                  <div key={i} style={{
                    background: isDark ? 'rgba(20,184,166,0.06)' : 'var(--md-surface-container-low)',
                    borderLeft: '3px solid var(--md-primary)',
                    borderRadius: '0 8px 8px 0',
                    padding: '14px 16px',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    margin: '8px 0',
                  }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 20, color: 'var(--md-primary)', flexShrink: 0, marginTop: 1,
                    }}>info</span>
                    <div>
                      <div style={{
                        fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500,
                        color: 'var(--md-on-surface)', marginBottom: 4, letterSpacing: '0.02em',
                      }}>
                        {section.title}
                      </div>
                      <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--md-on-surface-variant)', margin: 0 }}>
                        {section.text}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
          </div>
        )}
      </section>

      {/* ── Right Pane: AI Insights ── */}
      <aside style={{
        width: 300,
        flexShrink: 0,
        borderLeft: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
        background: isDark ? 'var(--md-surface)' : 'var(--md-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-primary)' }}>psychology</span>
          <h2 style={{
            fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)', margin: 0,
            letterSpacing: '-0.01em',
          }}>AI 洞察</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Card */}
          <InsightCard
            icon="summarize"
            title="文档摘要"
            isDark={isDark}
          >
            <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--md-on-surface-variant)', margin: 0 }}>
              本文档介绍了 DevHub API 的认证流程。涵盖通过 REST 生成 Personal Access Token 以及在标准 Bearer 认证头中使用它。同时说明了 Token 的 30 天过期策略。
            </p>
          </InsightCard>

          {/* Related Docs Card */}
          <InsightCard
            icon="account_tree"
            title="相关上下文"
            isDark={isDark}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['速率限制策略', 'Webhook 安全'].map(name => (
                <li key={name}>
                  <a
                    href="#"
                    onClick={e => e.preventDefault()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: 'var(--md-primary)',
                      textDecoration: 'none',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </InsightCard>

          {/* Spacer pushes chat input to bottom */}
          <div style={{ flex: 1 }} />

          {/* AI Chat Input */}
          <div>
            <label style={{
              display: 'block', fontSize: 12, fontFamily: 'var(--font-label)',
              fontWeight: 500, color: 'var(--md-on-surface-variant)', marginBottom: 8,
              letterSpacing: '0.02em',
            }}>
              对此文档提问
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="例如：如何刷新 Token？"
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'var(--md-surface-container-low)',
                  border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: '20px',
                  color: 'var(--md-on-surface)',
                  resize: 'none',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--md-primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'; }}
              />
              <button
                style={{
                  position: 'absolute', bottom: 10, right: 10,
                  width: 28, height: 28, borderRadius: 6,
                  background: 'var(--md-primary)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function InsightCard({ icon, title, children, isDark }: {
  icon: string;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
      border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
      borderRadius: 12,
      padding: 16,
      boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface)' }}>{icon}</span>
        <span style={{
          fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500,
          color: 'var(--md-on-surface)', letterSpacing: '0.02em',
        }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
