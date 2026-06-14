import { useState, useEffect, useRef } from 'react';
import { Input, Card, List, Tag, Space, Button, Empty, Spin, Typography } from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ProjectOutlined,
  TeamOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../api';

const { Text } = Typography;

interface SearchResult {
  type: 'project' | 'task' | 'document' | 'member';
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  highlight?: string;
}

const SEARCH_HISTORY_KEY = 'devhub_search_history';
const MAX_HISTORY = 10;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);

  useEffect(() => {
    loadSearchHistory();
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadSearchHistory = () => {
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch {
      setSearchHistory([]);
    }
  };

  const saveSearchHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, MAX_HISTORY);
    setSearchHistory(newHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      setShowHistory(true);
      return;
    }

    setLoading(true);
    setShowHistory(false);
    saveSearchHistory(value);

    try {
      const data = await searchApi.search(value);
      const searchResults: SearchResult[] = [];

      // 将搜索结果转换为统一格式
      if (data.projects) {
        data.projects.forEach((p) => {
          searchResults.push({
            type: 'project',
            id: p.id as string,
            title: p.name as string,
            description: p.description as string,
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

      setResults(searchResults);
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
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project': return <ProjectOutlined style={{ color: '#3b82f6' }} />;
      case 'task': return <FileTextOutlined style={{ color: '#22c55e' }} />;
      case 'document': return <FileTextOutlined style={{ color: '#8b5cf6' }} />;
      case 'member': return <TeamOutlined style={{ color: '#f59e0b' }} />;
      default: return <SearchOutlined />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'project': return '项目';
      case 'task': return '任务';
      case 'document': return '文档';
      case 'member': return '成员';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'project': return 'blue';
      case 'task': return 'green';
      case 'document': return 'purple';
      case 'member': return 'orange';
      default: return 'default';
    }
  };

  return (
    <Card
      style={{
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        borderRadius: 12,
      }}
      styles={{ body: { padding: 16 } }}
    >
      {/* Search Input */}
      <Input
        ref={inputRef}
        size="large"
        placeholder="搜索项目、任务、文档..."
        prefix={<SearchOutlined style={{ color: '#8b95a5' }} />}
        suffix={
          query && (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowHistory(true);
              }}
            />
          )
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
        allowClear
      />

      {/* Search History */}
      {showHistory && searchHistory.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              搜索历史
            </Text>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearSearchHistory}
            >
              清除
            </Button>
          </div>
          <Space wrap>
            {searchHistory.map((item, index) => (
              <Tag
                key={index}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setQuery(item);
                  handleSearch(item);
                }}
              >
                {item}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="搜索中..." />
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            找到 {results.length} 个结果
          </Text>
          <List
            dataSource={results}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '12px', borderRadius: 8, transition: 'all 0.15s ease' }}
                onClick={() => handleResultClick(item)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <List.Item.Meta
                  avatar={getTypeIcon(item.type)}
                  title={
                    <Space>
                      <span>{item.title}</span>
                      <Tag color={getTypeColor(item.type)} style={{ fontSize: 11 }}>
                        {getTypeLabel(item.type)}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      {item.description && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}
                        </Text>
                      )}
                      {item.projectName && item.type !== 'project' && (
                        <div style={{ fontSize: 11, color: '#8b95a5', marginTop: 4 }}>
                          项目: {item.projectName}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && (
        <Empty
          description="未找到匹配的结果"
          style={{ marginTop: 40 }}
        />
      )}
    </Card>
  );
}
