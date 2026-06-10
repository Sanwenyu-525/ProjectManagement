# 多项目并行启动功能规划

## 功能目标

允许用户一次性选择多个项目并同时启动，简化多项目开发的初始化流程。

---

## 需求场景

### 使用场景

1. **每日启动**：开发者打开 DevHub，一键启动今天要用的 3-5 个项目
2. **新环境搭建**：新成员加入，快速启动整个项目栈
3. **依赖项目**：微服务架构，同时启动多个相互依赖的服务
4. **演示准备**：演示前快速启动所有相关项目

### 用户痛点

- 当前：需要逐个打开项目、逐个启动命令
- 痛点：耗时、容易遗漏、项目间依赖难以管理
- 期望：一键启动、可视化进度、自动处理依赖

---

## 设计原则

### 核心原则

> **不要修改原项目的配置，一切危险操作的执行权都放在用户手上**

### 具体规则

1. **不修改配置文件**
   - 不自动修改 package.json、.env、docker-compose.yml 等
   - 不修改项目的源代码
   - 不修改项目的启动脚本

2. **不自动执行危险操作**
   - 不自动修改启动命令
   - 不自动注入环境变量到启动命令
   - 不自动安装依赖
   - 不自动删除端口占用

3. **提供信息和建议**
   - 显示检测到的端口冲突
   - 提供解决方案建议
   - 让用户决定是否执行

4. **用户确认优先**
   - 危险操作必须用户确认
   - 可逆操作也要提示用户
   - 给用户提供"跳过"和"取消"选项

---

## 功能设计

### 1. 项目选择器

**位置**：项目列表页面顶部工具栏

**交互**：
```
[✓] 全选（勾选框）
[ ] 项目A [✓] ← 用户勾选
[✓] 项目B ← 用户勾选
[ ] 项目C
```

**功能**：
- 批量勾选/取消勾选
- "全选"按钮
- 按状态筛选（只显示未运行的）
- 按技术栈筛选

### 2. 启动按钮

**位置**：工具栏右侧

**按钮状态**：
```
[▶ 启动选中项目] ← 默认
[⏳ 启动中...]   ← 启动过程中
[✓ 全部启动]    ← 全部完成
```

**交互流程**：
```
1. 用户勾选 3 个项目
2. 点击"启动选中项目"
3. 弹出确认对话框（显示启动提示）
4. 依次启动每个项目（带进度）
5. 每个项目启动完成后更新状态
6. 全部完成显示总结
```

### 3. 启动进度面板

**位置**：页面右侧或底部抽屉

**显示内容**：
```
启动进度（2/3 完成）

✅ 项目A - 已启动（端口：3000）
⏳ 项目B - 启动中...
   └ 启动命令：npm run dev
   └ 已运行 5 秒
❌ 项目C - 启动失败
   └ 错误：端口 8080 已被占用
   └ [重试] [跳过]
```

**功能**：
- 实时显示每个项目的启动状态
- 失败时提供重试/跳过选项
- 启动完成时自动关闭

### 4. 批量启动管理

**API 扩展**：
```typescript
export const projectsApi = {
  // 新增：批量启动
  startMultiple: (projectIds: string[]) =>
    cmd('projects_start_multiple', { projectIds }),
  
  // 新增：停止多个
  stopMultiple: (projectIds: string[]) =>
    cmd('projects_stop_multiple', { projectIds }),
  
  // 新增：获取所有运行状态
  getRunningStatus: () =>
    cmd('projects_get_running_status'),
};
```

### 5. 智能排序

**自动排序规则**：
1. 基础设施优先：数据库、缓存、消息队列
2. 后端服务：API 服务器
3. 前端应用：Web、移动端
4. 辅助服务：日志、监控

**示例**：
```
1. PostgreSQL (数据库)     ← 先启动
2. Redis (缓存)            ← 先启动
3. API Server (后端)       ← 再启动
4. Frontend (前端)         ← 最后启动
```

**依赖检测**：
- 自动检测项目的依赖关系（基于 docker-compose、package.json 等）
- 显示依赖关系图
- 按依赖顺序启动

---

## UI 设计

### 项目列表页面

```
┌──────────────────────────────────────────────────────────────────┐
│ 项目管理                           [搜索] [筛选] [启动选中 ▼]    │
├──────────────────────────────────────────────────────────────────┤
│ [✓] 全选  |  已选中 3/10 个项目                                  │
├──────────────────────────────────────────────────────────────────┤
│ [✓] Project A   │ Running │ Port: 3000   │ [启动] [停止] [设置] │
│ [✓] Project B   │ Stopped │              │ [启动] [停止] [设置] │
│ [ ] Project C   │ Stopped │              │ [启动] [停止] [设置] │
└──────────────────────────────────────────────────────────────────┘
```

### 启动进度弹窗

```
┌────────────────────────────────────────────────────────────┐
│ 多项目启动                                              [X] │
├────────────────────────────────────────────────────────────┤
│ ✅ PostgreSQL          已运行    Port: 5432                │
│ ✅ Redis               已运行    Port: 6379                │
│ ⏳ API Server          启动中    已运行 3 秒...             │
│    └ 命令: npm run dev                                     │
│ ❌ Frontend            启动失败                            │
│    └ 错误: 端口 3000 已被占用                               │
│    └ [重试]  [跳过]  [查看日志]                             │
├────────────────────────────────────────────────────────────┤
│ 进度: 2/4 完成  [取消全部]                                  │
└────────────────────────────────────────────────────────────┘
```

---

## 技术实现

### 前端实现

**状态管理**：
```typescript
// 批量启动状态
interface BatchLaunchState {
  selectedIds: string[];
  launching: boolean;
  progress: {
    projectId: string;
    status: 'pending' | 'launching' | 'success' | 'failed';
    error?: string;
    terminalId?: string;
    startTime?: number;
    port?: number;        // 新增：实际使用的端口
    originalPort?: number; // 新增：项目配置的原始端口
  }[];
}
```

**并发控制**：
```typescript
// 限制同时启动的项目数（避免资源竞争）
const MAX_CONCURRENT = 3;

async function launchMultiple(projects: Project[]) {
  const queue = [...projects];
  const running: Promise[] = [];
  
  while (queue.length > 0 || running.length > 0) {
    while (running.length < MAX_CONCURRENT && queue.length > 0) {
      const project = queue.shift()!;
      const promise = launchProject(project)
        .finally(() => running.splice(running.indexOf(promise), 1));
      running.push(promise);
    }
    
    await Promise.race(running);
  }
}
```

### 端口冲突管理

**问题**：多个项目可能默认使用相同端口（如 3000、8080）

**解决方案**：三级端口管理策略

#### 1. 临时端口配置（推荐方案）

**核心原理**：通过环境变量临时覆盖配置，不修改任何文件

**实现方式**：
```bash
# ✅ 临时指定端口，不修改配置文件
PORT=3001 npm run dev

# 或者通过命令行参数（如果框架支持）
npm run dev -- --port=3001
```

**环境变量的优势**：
1. ✅ 不修改 package.json
2. ✅ 不修改 .env 文件
3. ✅ 只在当前进程生效，关闭进程后消失
4. ✅ 优先级高于 .env 文件
5. ✅ 所有框架都支持

**实现流程**：
```
检测到端口冲突
      ↓
询问用户：是否使用临时端口？
      ↓
用户选择临时端口方案
      ↓
自动在启动命令前添加环境变量
      ↓
使用 `PORT=3001 npm run dev` 启动
      ↓
不修改任何项目配置文件
```

**临时端口配置 UI**：
```
┌────────────────────────────────────────────────────┐
│ ⚠️ 端口冲突 - 临时解决方案                          │
├────────────────────────────────────────────────────┤
│ 项目：Frontend App                                 │
│ 默认端口：3000（已被占用）                          │
│                                                    │
│ 你可以使用临时端口启动，不修改项目配置：            │
│                                                    │
│ 临时端口：[3001]                                   │
│ 启动命令：PORT=3001 npm run dev                    │
│                                                    │
│ ✅ 不会修改 .env 文件                              │
│ ✅ 不会修改 package.json                          │
│ ✅ 关闭进程后自动失效                              │
│                                                    │
│ [使用临时端口]  [打开配置文件]  [跳过项目]          │
└────────────────────────────────────────────────────┘
```

**实现代码**：
```typescript
async function launchWithTemporaryPort(
  project: Project,
  tempPort: number
) {
  const originalCommand = project.openCommand;
  
  // 判断是 npm/yarn/pnpm 还是其他
  if (originalCommand.match(/^(npm|yarn|pnpm|bun)\s+run/)) {
    // Node.js 项目：使用 PORT 环境变量
    const tempCommand = `PORT=${tempPort} ${originalCommand}`;
    return await terminalApi.start(project.id, tempCommand, project.localPath);
  }
  
  if (originalCommand.includes('python') || originalCommand.includes('flask')) {
    // Flask：使用 FLASK_RUN_PORT
    const tempCommand = `FLASK_RUN_PORT=${tempPort} ${originalCommand}`;
    return await terminalApi.start(project.id, tempCommand, project.localPath);
  }
  
  if (originalCommand.includes('django')) {
    // Django：使用 --port 参数
    const tempCommand = `${originalCommand} --port=${tempPort}`;
    return await terminalApi.start(project.id, tempCommand, project.localPath);
  }
  
  if (originalCommand.includes('java') || originalCommand.includes('spring')) {
    // Spring Boot：使用 --server.port
    const tempCommand = `${originalCommand} --server.port=${tempPort}`;
    return await terminalApi.start(project.id, tempCommand, project.localPath);
  }
  
  // 通用方式：使用 PORT 环境变量
  const tempCommand = `PORT=${tempPort} ${originalCommand}`;
  return await terminalApi.start(project.id, tempCommand, project.localPath);
}
```

**端口分配策略**：
```typescript
async function suggestTemporaryPort(project: Project): Promise<number> {
  const defaultPort = extractPortFromProject(project);
  
  // 尝试默认端口 + 10 的倍数（避免冲突）
  for (let offset = 10; offset < 100; offset += 10) {
    const candidatePort = defaultPort + offset;
    if (await isPortAvailable(candidatePort)) {
      return candidatePort;
    }
  }
  
  // 尝试其他常用端口
  const commonPorts = [8000, 8080, 8888, 9000, 9090, 5000, 5173, 4200];
  for (const port of commonPorts) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error('无法找到可用端口');
}
```

#### 2. 端口冲突检测（只读）

**检测时机**：
- 项目启动前自动检测
- 发现冲突时通知用户

**检测流程**：
```
1. 解析项目配置的端口（从启动命令、.env、package.json）
2. 检查端口是否被占用
3. 如果占用，给用户三个选择：
   - [修改项目配置] - 打开配置文件让用户手动修改
   - [跳过此项目] - 不启动这个项目
   - [取消批量启动] - 取消整个操作
4. 不自动修改任何配置
```

**错误提示 UI**：
```
┌──────────────────────────────────────────────────────┐
│ ⚠️ 端口冲突检测                                      │
├──────────────────────────────────────────────────────┤
│ 项目：Frontend App                                   │
│ 默认端口：3000                                       │
│ 状态：端口 3000 已被占用                              │
│                                                      │
│ 建议的解决方案：                                      │
│ 1. 修改 .env 文件，将 PORT 改为 3001                 │
│ 2. 修改 package.json 中的 start 命令                 │
│ 3. 关闭占用端口 3000 的进程                          │
│                                                      │
│ [打开配置文件]  [跳过此项目]  [取消批量启动]          │
└──────────────────────────────────────────────────────┘
```

**实现**：
```typescript
async function checkPortConflicts(projects: Project[]): Promise<PortConflict[]> {
  const conflicts: PortConflict[] = [];
  
  for (const project of projects) {
    const port = await extractPortFromProject(project);
    const isAvailable = await isPortAvailable(port);
    
    if (!isAvailable) {
      conflicts.push({
        projectId: project.id,
        projectName: project.name,
        preferredPort: port,
        status: 'conflict',
        suggestions: [
          `修改 ${project.localPath}/.env 中的 PORT 变量`,
          `修改 ${project.localPath}/package.json 中的启动命令`,
          `关闭占用端口 ${port} 的进程`,
        ]
      });
    }
  }
  
  return conflicts;
}
```

#### 2. 端口配置 UI（只读显示）

**项目详情页**：

```
┌────────────────────────────────────────────────┐
│ 项目配置                                         │
├────────────────────────────────────────────────┤
│ 启动命令：npm run dev                           │
│ 端口配置：                                      │
│   ├ 项目配置端口：3000                          │
│   ├ 端口状态：✓ 可用 / ⚠️ 冲突                  │
│   └ 如果冲突，需要修改配置文件                  │
│ 环境变量：                                      │
│   └ PORT=3000（从 .env 文件读取）               │
└────────────────────────────────────────────────┘
```

**批量启动时的端口检测**：

```
┌────────────────────────────────────────────────────┐
│ 端口检测结果                                       │
├────────────────────────────────────────────────────┤
│ ✅ 项目 A: 端口 3000 可用                          │
│ ⚠️ 项目 B: 端口 3000 冲突                         │
│    └ [打开 .env] [跳过项目 B] [取消]              │
│ ✅ 项目 C: 端口 5432 可用                          │
│ ⚠️ 项目 D: 端口 8080 冲突                         │
│    └ [打开 docker-compose.yml] [跳过项目 D] [取消]│
└────────────────────────────────────────────────────┘
```

#### 3. 信息展示，不修改配置

**正确做法**：

```typescript
// ✅ 正确：显示信息，让用户决定
async function handlePortConflict(project: Project, port: number) {
  // 显示冲突信息
  showConflictDialog({
    project: project.name,
    port: port,
    message: `端口 ${port} 已被占用`,
    options: [
      {
        label: '打开配置文件',
        action: () => openFileInEditor(`${project.localPath}/.env`),
      },
      {
        label: '跳过此项目',
        action: () => skipProject(project.id),
      },
      {
        label: '取消批量启动',
        action: () => cancelBatchLaunch(),
      },
    ]
  });
}

// ❌ 错误：自动修改配置
async function handlePortConflict(project: Project, port: number) {
  // 不应该这样做！
  const newPort = await findAvailablePort(port);
  await modifyEnvFile(project.localPath, { PORT: newPort }); // ❌ 不要自动修改
  await modifyStartCommand(project.openCommand, newPort);     // ❌ 不要自动修改
}
```

**危险操作提示**：

```typescript
const DANGEROUS_OPERATIONS = [
  '修改 package.json',
  '修改 .env 文件',
  '修改 docker-compose.yml',
  '修改启动脚本',
  '安装新依赖',
  '删除进程',
  '修改端口号',
];

function warnDangerousOperation(operation: string) {
  if (DANGEROUS_OPERATIONS.some(d => operation.includes(d))) {
    return Modal.confirm({
      title: '⚠️ 危险操作警告',
      content: `即将执行危险操作：${operation}。此操作可能影响项目配置。是否继续？`,
      okText: '我已了解风险，继续',
      cancelText: '取消',
    });
  }
}
```

#### 4. 用户手动配置的引导

**引导流程**：

```
1. 检测到端口冲突
      ↓
2. 显示冲突信息和建议
      ↓
3. 用户选择"打开配置文件"
      ↓
4. 在编辑器中打开对应的配置文件
      ↓
5. 用户手动修改配置
      ↓
6. 用户返回 DevHub 点击"重新检测"
      ↓
7. 确认端口冲突已解决
      ↓
8. 继续批量启动
```

**自动打开配置文件**：

```typescript
async function openConfigFile(project: Project) {
  const configFiles = [
    '.env',
    '.env.local',
    'package.json',
    'docker-compose.yml',
    'config.js',
  ];
  
  for (const file of configFiles) {
    const fullPath = `${project.localPath}/${file}`;
    if (await fileExists(fullPath)) {
      await openFileInSystemEditor(fullPath);
      return;
    }
  }
  
  message.info('未找到配置文件，请手动修改启动命令中的端口');
}
```

### 后端实现（Tauri）

**端口检测命令**：
```rust
#[tauri::command]
pub async fn check_port_available(port: u16) -> Result<bool, String> {
    use std::net::TcpListener;
    
    match TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn get_port_usage() -> Result<Vec<PortUsage>, String> {
    // 返回当前所有被占用的端口
    // 这是只读操作，不修改任何东西
}
```

**批量启动命令**（不修改配置）：
```rust
#[tauri::command]
pub async fn projects_start_multiple(
    app: AppHandle,
    project_ids: Vec<String>,
) -> Result<Vec<ProjectStartResult>, String> {
    let mut results = vec![];
    
    for project_id in project_ids {
        // 获取项目配置（只读）
        let project = get_project(&app, &project_id).await?;
        
        // 检测端口冲突（只读）
        let port = extract_port_from_project(&project);
        let is_available = check_port_available(port).await?;
        
        if !is_available {
            // 返回冲突信息，不自动修改
            results.push(ProjectStartResult {
                project_id: project_id.clone(),
                success: false,
                error: Some(format!("端口 {} 已被占用，请修改项目配置", port)),
                port: Some(port),
            });
            continue;
        }
        
        // 使用项目配置的原始启动命令（不修改）
        let result = start_project(&app, &project_id).await;
        results.push(result);
    }
    
    Ok(results)
}
```

### 5. 批量启动流程（修正版）

```
用户选择多个项目
        ↓
系统检测端口冲突（只读）
        ↓
┌─ 无冲突 ─┐          ┌─ 有冲突 ─┐
│ 继续启动  │          │ 显示冲突  │
└─────────┘          └─────────┘
        ↓                   ↓
                    显示冲突详情
                    提供三个选项：
                    ├ [打开配置文件] → 用户手动修改
                    ├ [跳过项目] → 不启动这个
                    └ [取消] → 取消批量启动
        ↓
用户确认所有冲突已解决
        ↓
使用原始配置启动所有项目
        ↓
显示启动结果
```

---

## 实现优先级

### Phase 1（基础批量启动）
- [ ] 项目勾选 UI
- [ ] 启动选中项目按钮
- [ ] 基础进度显示
- [ ] 单个失败重试

### Phase 2（智能功能）
- [ ] 自动排序
- [ ] 依赖关系检测
- [ ] 启动提示弹窗集成
- [ ] 批量停止

### Phase 3（高级功能）
- [ ] 启动编排配置（自定义顺序）
- [ ] 端口冲突自动处理
- [ ] 启动历史记录
- [ ] 快速启动配置文件

#### 3.1 启动编排配置

**功能**：用户可以自定义项目启动顺序

**UI 设计**：
```
┌────────────────────────────────────────────┐
│ 启动编排配置                               │
├────────────────────────────────────────────┤
│ 启动顺序（拖拽调整）：                     │
│                                            │
│ 1️⃣ PostgreSQL (数据库)        [↑] [↓] [×] │
│ 2️⃣ Redis (缓存)              [↑] [↓] [×] │
│ 3️⃣ API Server (后端)         [↑] [↓] [×] │
│ 4️⃣ Frontend (前端)           [↑] [↓] [×] │
│                                            │
│ [保存为预设]  [加载预设]                   │
└────────────────────────────────────────────┘
```

**存储位置**：
- 本地存储：`~/.devhub/launch-profiles.json`
- 支持多个配置文件
- 可以保存/加载/删除配置

#### 3.2 端口冲突自动处理

**功能**：端口冲突时自动分配临时端口

**实现方式**：
```typescript
async function handlePortConflict(
  project: Project,
  preferredPort: number
): Promise<{ port: number; modified: boolean }> {
  // 检测端口是否被占用
  const isAvailable = await checkPortAvailable(preferredPort);
  
  if (isAvailable) {
    return { port: preferredPort, modified: false };
  }
  
  // 端口被占用，分配临时端口
  const tempPort = await findAvailablePort(preferredPort);
  
  // 使用临时端口启动（不修改配置）
  const tempCommand = `PORT=${tempPort} ${project.openCommand}`;
  
  return { port: tempPort, modified: true };
}
```

**UI 显示**：
```
⚠️ 端口冲突已自动解决

项目：Frontend App
原始端口：3000（被占用）
临时端口：3001
启动命令：PORT=3001 npm run dev

[查看详情]  [修改配置]
```

#### 3.3 启动历史记录

**功能**：记录每次批量启动的历史

**存储结构**：
```typescript
interface LaunchHistory {
  id: string;
  timestamp: Date;
  projects: Array<{
    projectId: string;
    projectName: string;
    status: 'success' | 'failed';
    port?: number;
    error?: string;
  }>;
  totalDuration: number; // 毫秒
  successCount: number;
  failedCount: number;
}
```

**UI 显示**：
```
┌────────────────────────────────────────────┐
│ 启动历史记录                               │
├────────────────────────────────────────────┤
│ 2024-01-15 10:30  ✅ 4/4 成功  12s        │
│ 2024-01-14 09:15  ⚠️ 3/4 成功  15s        │
│ 2024-01-13 14:20  ❌ 1/4 成功  8s         │
│                                            │
│ [查看详情]  [重复启动]  [清除历史]         │
└────────────────────────────────────────────┘
```

#### 3.4 快速启动配置文件

**功能**：保存常用项目组合为快速启动配置

**配置文件结构**：
```typescript
interface LaunchProfile {
  id: string;
  name: string;           // 如 "日常开发"、"演示环境"
  description?: string;
  projectIds: string[];   // 项目 ID 列表
  launchOrder: 'smart' | 'manual' | 'selected';
  customOrder?: string[]; // 手动排序时的顺序
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}
```

**UI 设计**：
```
┌────────────────────────────────────────────┐
│ 快速启动配置                               │
├────────────────────────────────────────────┤
│ [日常开发] 4 个项目  [▶ 启动]  [编辑]     │
│ [演示环境] 6 个项目  [▶ 启动]  [编辑]     │
│ [测试环境] 3 个项目  [▶ 启动]  [编辑]     │
│                                            │
│ [+ 新建配置]  [导入配置]  [导出配置]       │
└────────────────────────────────────────────┘
```

---

## 风险和挑战

### 技术挑战

1. **端口冲突**：多个项目可能需要相同端口
   - 解决：自动检测并分配可用端口

2. **资源竞争**：同时启动多个项目可能耗尽资源
   - 解决：限制并发数，队列管理

3. **状态同步**：需要实时同步多个项目的状态
   - 解决：WebSocket 或轮询

### 用户体验挑战

1. **信息过载**：同时显示太多项目状态
   - 解决：分层展示，折叠/展开

2. **错误处理**：部分成功、部分失败的情况
   - 解决：清晰的成功/失败状态，一键重试

---

## 验收标准

### 基础验收

- [ ] 用户可以勾选多个项目
- [ ] 点击启动按钮后，所有选中项目依次启动
- [ ] 实时显示每个项目的启动状态
- [ ] 失败时可以重试

### 完整验收

- [ ] 启动顺序符合智能排序规则
- [ ] 依赖关系正确处理
- [ ] 并发数不超过限制
- [ ] 所有项目启动完成显示总结
- [ ] 可以批量停止所有项目

---

## 下一步

1. 审阅这个规划
2. 确认优先级和范围
3. 开始 Phase 1 的实现

---

## 实现进度

### Phase 1 ✅ 完成
- [x] 项目勾选 UI
- [x] 启动选中项目按钮
- [x] 基础进度显示
- [x] 单个失败重试
- [x] 批量启动确认对话框
- [x] 端口冲突检测

### Phase 2 ✅ 完成
- [x] 自动排序（根据项目类型）
- [x] 批量停止功能
- [x] 启动提示弹窗集成
- [x] 优先级标签（基础设施、后端、前端等）

### Phase 3 ✅ 完成
- [x] 快速启动配置（保存/加载项目组合）
- [x] 启动历史记录
- [x] 导出/导入配置
- [x] 依赖关系检测（后端 API）
- [x] 启动顺序计算（拓扑排序）

### UI 优化 ✅ 完成
- [x] 工具栏布局优化
- [x] 项目卡片样式优化（圆角、阴影、过渡动画）
- [x] 批量启动进度面板优化
- [x] 按钮样式优化（渐变色、阴影）
- [x] Tooltip 提示优化

### 后端 API ✅ 完成
- [x] 依赖关系检测 API
- [x] 启动顺序计算 API（拓扑排序）
- [x] Docker Compose 分析 API
- [x] Monorepo 结构检测 API
