# 项目状态监控仪表盘

## 功能目标

提供实时的项目运行状态监控，帮助用户快速了解所有项目的健康状况和资源使用情况。

---

## 功能设计

### 1. 项目状态总览

**核心指标**：
- 运行中的项目数
- 停止的项目数
- 异常的项目数
- 总项目数

**UI 设计**：
```
┌──────────────────────────────────────────────────────────────┐
│ 项目状态监控                                               [刷新] │
├──────────────────────────────────────────────────────────────┤
│ [运行中]  [停止]  [异常]  [总数]                              │
│   5        3       1       9                                 │
└──────────────────────────────────────────────────────────────┘
```

### 2. 项目状态卡片

**每个项目显示**：
- 项目名称
- 运行状态（运行中/停止/异常）
- 启动时间
- 端口号
- CPU/内存使用率
- 健康度评分

**UI 设计**：
```
┌────────────────────────────────────┐
│ DevHub API        [运行中] ⚠️ 85%  │
│ 运行时间: 2h 30m   端口: 3000      │
│ CPU: ████████░░ 80%                │
│ 内存: ██████░░░░ 60%               │
└────────────────────────────────────┘
```

### 3. 健康度评分

**评分标准**：
- CPU 使用率 > 90%：扣分
- 内存使用率 > 80%：扣分
- 运行时间 < 1 分钟：扣分（可能刚启动或崩溃）
- 最近有错误日志：扣分

**评分等级**：
- 90-100%：优秀（绿色）
- 70-89%：良好（蓝色）
- 50-69%：警告（黄色）
- 0-49%：异常（红色）

### 4. 资源使用图表

**图表类型**：
- CPU 使用率折线图（最近 1 小时）
- 内存使用率折线图（最近 1 小时）
- 端口占用分布图
- 项目状态分布饼图

---

## 技术实现

### 前端组件

#### 1. DashboardPage.tsx

```typescript
// 主仪表盘页面
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000); // 每 5 秒刷新
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <StatusOverview stats={stats} />
      <ResourceCharts data={projectStatuses} />
      <ProjectStatusGrid projects={projectStatuses} />
    </div>
  );
}
```

#### 2. StatusOverview.tsx

```typescript
// 状态总览卡片
const StatusOverview = ({ stats }) => (
  <Row gutter={16}>
    <Col span={6}>
      <Card>
        <Statistic title="运行中" value={stats.running} valueStyle={{ color: '#52c41a' }} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic title="已停止" value={stats.stopped} valueStyle={{ color: '#8b95a5' }} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic title="异常" value={stats.error} valueStyle={{ color: '#ff4d4f' }} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic title="总数" value={stats.total} />
      </Card>
    </Col>
  </Row>
);
```

#### 3. ProjectStatusCard.tsx

```typescript
// 项目状态卡片
const ProjectStatusCard = ({ project }) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <h4>{project.name}</h4>
        <Tag color={getStatusColor(project.status)}>{project.status}</Tag>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div>运行时间: {formatDuration(project.uptime)}</div>
        <div>端口: {project.port}</div>
      </div>
    </div>
    <Progress percent={project.cpuUsage} size="small" />
    <Progress percent={project.memoryUsage} size="small" />
    <div style={{ marginTop: 8 }}>
      健康度: <Progress type="circle" percent={project.healthScore} size={40} />
    </div>
  </Card>
);
```

### 后端 API

#### 1. 状态监控 API

```rust
#[tauri::command]
pub async fn get_project_status(
    project_id: String,
) -> Result<ProjectStatus, String> {
    // 获取项目运行状态
    // 检查进程是否在运行
    // 获取 CPU/内存使用率
    // 计算健康度评分
}

#[tauri::command]
pub async fn get_all_project_statuses() -> Result<Vec<ProjectStatus>, String> {
    // 获取所有项目的状态
}
```

#### 2. 资源监控 API

```rust
#[tauri::command]
pub async fn get_system_resources() -> Result<SystemResources, String> {
    // 获取系统资源信息
    // CPU 总使用率
    // 内存总使用率
    // 磁盘使用率
}
```

### 数据结构

```typescript
interface ProjectStatus {
  projectId: string;
  projectName: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;           // 运行时间（秒）
  port: number;
  cpuUsage: number;         // 0-100
  memoryUsage: number;      // 0-100
  healthScore: number;      // 0-100
  lastError?: string;
  startedAt: Date;
}

interface DashboardStats {
  running: number;
  stopped: number;
  error: number;
  total: number;
}

interface SystemResources {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}
```

---

## 实现优先级

### Phase 1（基础监控）
- [ ] 项目状态总览（运行中/停止/异常数量）
- [ ] 项目状态列表（名称、状态、端口）
- [ ] 自动刷新（每 5 秒）

### Phase 2（详细信息）
- [ ] 运行时间显示
- [ ] 健康度评分
- [ ] CPU/内存使用率显示

### Phase 3（可视化）
- [ ] CPU 使用率折线图
- [ ] 内存使用率折线图
- [ ] 项目状态分布饼图
- [ ] 端口占用图

### Phase 4（告警）
- [ ] 健康度低于阈值告警
- [ ] CPU/内存过高告警
- [ ] 项目异常告警

---

## UI 布局

```
┌──────────────────────────────────────────────────────────────┐
│ 项目状态监控                                                 │
├──────────────────────────────────────────────────────────────┤
│ [运行中: 5]  [停止: 3]  [异常: 1]  [总数: 9]  [刷新]        │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────┐  ┌────────────────────┐              │
│ │ CPU 使用率         │  │ 内存使用率         │              │
│ │    [折线图]        │  │    [折线图]        │              │
│ └────────────────────┘  └────────────────────┘              │
├──────────────────────────────────────────────────────────────┤
│ 项目列表                                                     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ Project A    │ │ Project B    │ │ Project C    │          │
│ │ [运行中]     │ │ [停止]       │ │ [异常]       │          │
│ │ CPU: 80%     │ │ CPU: 0%      │ │ CPU: 95%     │          │
│ │ 内存: 60%    │ │ 内存: 0%     │ │ 内存: 85%    │          │
│ │ 健康: 90%    │ │ 健康: N/A    │ │ 健康: 45%    │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
└──────────────────────────────────────────────────────────────┘
```
