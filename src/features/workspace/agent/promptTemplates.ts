/* ── Prompt Template System — SDLC workflow prompts ── */

export type PromptPhase =
  | 'requirements'
  | 'architecture'
  | 'uiux'
  | 'coding'
  | 'debugging'
  | 'testing'
  | 'performance'
  | 'security'
  | 'release';

export interface PromptVariable {
  /** Name used in {{name}} template syntax */
  name: string;
  /** Display label in the fill-in modal */
  label: string;
  /** Placeholder text */
  placeholder?: string;
}

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  phase: PromptPhase;
  /** Template body with {{variable}} placeholders */
  template: string;
  /** Declared variables; auto-extracted from {{...}} if omitted */
  variables?: PromptVariable[];
  /** Tags for cross-phase search */
  tags?: string[];
}

/* ── Phase metadata ── */

export const PHASE_META: Record<PromptPhase, { label: string; icon: string; order: number }> = {
  requirements: { label: '需求分析', icon: 'edit_note', order: 0 },
  architecture: { label: '架构设计', icon: 'architecture', order: 1 },
  uiux:         { label: 'UI/UX', icon: 'palette', order: 2 },
  coding:       { label: '编码', icon: 'code', order: 3 },
  debugging:    { label: '调试', icon: 'bug_report', order: 4 },
  testing:      { label: '测试', icon: 'science', order: 5 },
  performance:  { label: '性能', icon: 'speed', order: 6 },
  security:     { label: '安全', icon: 'security', order: 7 },
  release:      { label: '发布', icon: 'rocket_launch', order: 8 },
};

/* ── Template helpers ── */

/** Extract {{name}} placeholders from template text into PromptVariable[] */
export function extractVariables(template: string): PromptVariable[] {
  const seen = new Set<string>();
  const vars: PromptVariable[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      vars.push({ name: m[1], label: m[1], placeholder: `输入 ${m[1]}...` });
    }
  }
  return vars;
}

/** Replace {{name}} with user-provided values */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? '');
}

/** Get effective variables — declared or auto-extracted */
export function getVariables(t: PromptTemplate): PromptVariable[] {
  return t.variables ?? extractVariables(t.template);
}

/* ── All prompt templates (migrated from AgentTabBar) ── */

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ════════════════════════════════════════════
  //  Requirements — 需求分析
  // ════════════════════════════════════════════
  {
    id: 'prd',
    label: 'PRD 生成',
    description: '根据需求生成完整产品需求文档',
    icon: 'edit_note',
    phase: 'requirements',
    template: `根据下面需求生成完整PRD。

包含：

- 项目背景
- 用户故事
- 功能列表
- 页面结构
- 权限设计
- 数据流
- 异常流程
- 验收标准

需求：

{{input}}`,
    variables: [{ name: 'input', label: '需求描述', placeholder: '描述你的产品需求...' }],
    tags: ['产品', '需求'],
  },

  // ════════════════════════════════════════════
  //  Architecture — 架构设计
  // ════════════════════════════════════════════
  {
    id: 'tech-design',
    label: '方案设计',
    description: '结构化技术方案设计模板',
    icon: 'architecture',
    phase: 'architecture',
    template: `请为以下需求设计技术方案，输出格式：

## 1. 需求理解
用自己的话复述需求，列出关键约束和假设

## 2. 方案对比
给出 2-3 个可选方案，每个方案列出：
- 实现思路
- 优点
- 缺点和风险
- 预估工作量

## 3. 推荐方案
说明选择理由，给出详细的实现步骤

## 4. 数据模型变更
列出需要新增/修改的表、字段、索引

## 5. API 变更
列出需要新增/修改的接口及契约

## 6. 前端变更
列出需要新增/修改的组件和页面

## 7. 测试策略
需要新增哪些测试，如何验证

需求：{{input}}`,
    variables: [{ name: 'input', label: '需求描述', placeholder: '描述技术需求...' }],
    tags: ['架构', '方案'],
  },
  {
    id: 'api-design',
    label: '接口设计',
    description: '完整的 API 接口契约设计',
    icon: 'api',
    phase: 'architecture',
    template: `请帮我设计以下功能的 API 接口，要求：
1. RESTful 风格，遵循项目的 URL 命名约定
2. 请求/响应的完整 TypeScript 类型定义
3. 输入验证规则和错误码设计
4. 分页、过滤、排序的统一约定
5. 认证和权限控制方案
6. 速率限制和幂等性考虑
7. 向后兼容性策略

同时给出前端 API 调用层的封装代码。

功能描述：{{input}}`,
    variables: [{ name: 'input', label: '功能描述', placeholder: '描述需要设计的 API...' }],
    tags: ['API', '接口'],
  },
  {
    id: 'db-design',
    label: '数据库设计',
    description: '数据库表结构和迁移方案设计',
    icon: 'schema',
    phase: 'architecture',
    template: `请帮我设计以下功能的数据库方案：
1. 新增/修改的表结构（CREATE TABLE SQL）
2. 字段类型选择理由（为什么用 TEXT 而不是 VARCHAR）
3. 索引设计（覆盖查询场景 + 选择理由）
4. 外键约束和级联规则
5. 数据迁移脚本（增量 migration，不丢数据）
6. 预估数据量和性能影响
7. 潜在的锁竞争和并发问题

功能描述：{{input}}`,
    variables: [{ name: 'input', label: '功能描述', placeholder: '描述数据库需求...' }],
    tags: ['数据库', 'SQL'],
  },

  // ════════════════════════════════════════════
  //  UI/UX — 前端设计
  // ════════════════════════════════════════════
  {
    id: 'component-design',
    label: '组件设计',
    description: '完整的 React 组件设计方案',
    icon: 'widgets',
    phase: 'uiux',
    template: `请帮我设计一个 React 组件，要求：
1. 明确组件的 Props 接口（TypeScript 类型）
2. 状态管理策略（useState / useReducer / Zustand）
3. 性能优化点（memo、useMemo、useCallback 的使用场景）
4. 可访问性（ARIA 属性、键盘导航）
5. 边界情况处理（加载态、空态、错误态）
6. 组件文档（JSDoc + 使用示例）
7. 遵循项目的 UI 规范（Ant Design + Glassmorphism）

组件需求：{{input}}`,
    variables: [{ name: 'input', label: '组件需求', placeholder: '描述组件的功能和行为...' }],
    tags: ['React', '组件'],
  },
  {
    id: 'responsive',
    label: '响应式适配',
    description: '多端响应式布局适配方案',
    icon: 'devices',
    phase: 'uiux',
    template: `请帮我将以下界面/组件改为响应式布局：
1. 分析当前布局在不同断点下的表现
2. 给出 mobile（<768px）、tablet（768-1024px）、desktop（>1024px）的布局方案
3. 识别需要隐藏/折叠/重排的元素
4. 使用 CSS 变量保持主题一致性
5. 考虑触摸交互（更大的点击区域、手势支持）

目标组件：{{input}}`,
    variables: [{ name: 'input', label: '目标组件', placeholder: '粘贴组件代码或描述...' }],
    tags: ['响应式', '布局'],
  },
  {
    id: 'state-analysis',
    label: '状态管理',
    description: 'React 状态架构分析和优化',
    icon: 'hub',
    phase: 'uiux',
    template: `请帮我分析和优化以下组件的状态管理：
1. 列出当前所有状态及其更新触发条件
2. 识别可以提升到 store 的共享状态
3. 识别可以从 props 推导的冗余状态
4. 分析不必要的重渲染（哪个状态变化导致了不需要的渲染）
5. 给出优化后的状态架构和代码

目标组件：{{code}}`,
    variables: [{ name: 'code', label: '目标组件', placeholder: '模块名、文件路径或代码...' }],
    tags: ['状态', '性能', 'React'],
  },

  // ════════════════════════════════════════════
  //  Coding — 编码
  // ════════════════════════════════════════════
  {
    id: 'explain-code',
    label: '解释代码',
    description: '深入解读代码逻辑、设计意图和改进空间',
    icon: 'code',
    phase: 'coding',
    template: `请用中文详细解释以下代码的完整逻辑：
1. 这段代码的整体作用和在项目中的定位
2. 每个核心函数/方法的职责和调用关系
3. 使用了哪些设计模式或架构模式，为什么这样设计
4. 关键的边界条件和异常处理逻辑
5. 潜在的改进空间

目标：{{code}}`,
    variables: [{ name: 'code', label: '目标代码', placeholder: '模块名、文件路径或代码...' }],
    tags: ['理解', '代码'],
  },
  {
    id: 'call-chain',
    label: '调用链分析',
    description: '追踪函数调用链路，梳理依赖关系',
    icon: 'account_tree',
    phase: 'coding',
    template: `请分析以下函数/模块的完整调用链：
1. 从入口开始，列出所有被调用的函数及其所在文件
2. 画出调用关系图（用文本表示）
3. 标注每个调用的同步/异步性质
4. 标注可能抛出异常的位置
5. 分析是否存在循环依赖或性能瓶颈

入口：{{input}}`,
    variables: [{ name: 'input', label: '函数/模块入口', placeholder: '输入函数名或模块路径...' }],
    tags: ['调用链', '依赖'],
  },
  {
    id: 'impact-analysis',
    label: '代码影响分析',
    description: '评估代码变更的影响范围',
    icon: 'radar',
    phase: 'coding',
    template: `如果我要修改以下代码/接口，请分析：
1. 直接调用方（哪些文件、函数会受影响）
2. 间接影响（通过事件、状态、数据库产生的连锁反应）
3. 需要同步修改的测试用例
4. 需要注意的向后兼容性问题
5. 建议的安全修改策略（渐进式 vs 一次性）

目标代码：{{input}}`,
    variables: [{ name: 'input', label: '目标代码/接口', placeholder: '模块名、文件路径或代码...' }],
    tags: ['影响', '重构'],
  },
  {
    id: 'review',
    label: 'Review',
    description: '按优先级分级的全面代码审查',
    icon: 'rate_review',
    phase: 'coding',
    template: `请对以下代码进行全面审查，按优先级排列问题：

**P0 — 必须修复**（会导致 bug、数据丢失、安全漏洞）
**P1 — 强烈建议**（性能问题、可维护性隐患）
**P2 — 可选优化**（代码风格、可读性提升）

对每个问题请说明：具体位置、问题描述、修复建议和修改后的代码示例。

目标：{{input}}`,
    variables: [{ name: 'input', label: '审查目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['审查', '质量'],
  },
  {
    id: 'code-smell',
    label: '坏味道检测',
    description: '检测代码坏味道并给出重构建议',
    icon: 'smoking_rooms',
    phase: 'coding',
    template: `请检测以下代码中的「代码坏味道」（Code Smells），逐项列出：
- 重复代码（DRY 违反）
- 过长函数（超过 50 行）
- 过大的类/文件
- 过深的嵌套层级（>3 层）
- 魔法数字/硬编码字符串
- 未使用的导入/变量/参数
- 不一致的命名风格
- 缺失的类型标注

对每个问题给出重构建议和具体修改步骤。

目标：{{input}}`,
    variables: [{ name: 'input', label: '检测目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['坏味道', '重构'],
  },
  {
    id: 'safe-refactor',
    label: '安全重构',
    description: '分步骤的安全重构方案',
    icon: 'recycling',
    phase: 'coding',
    template: `请帮我安全地重构以下代码，要求：
1. 先分析当前代码的问题（列出具体坏味道）
2. 给出重构后的目标结构
3. 拆分为可独立验证的小步骤（每步都保持功能不变）
4. 每步标注需要运行的验证命令/测试
5. 标注可能影响的外部接口
6. 给出回滚方案（如果重构出问题）

重构目标：{{code}}`,
    variables: [{ name: 'code', label: '重构目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['重构', '安全'],
  },
  {
    id: 'dep-upgrade',
    label: '依赖升级',
    description: '安全的依赖版本升级指南',
    icon: 'upgrade',
    phase: 'coding',
    template: `请帮我升级以下依赖/框架版本：
1. 分析当前版本和目标版本之间的 Breaking Changes
2. 列出所有需要修改的文件和具体修改点
3. 按依赖关系排序修改顺序
4. 每个修改点给出修改前/后的代码对比
5. 列出升级后的验证步骤
6. 标注需要同步更新的类型定义

依赖：{{input}}`,
    variables: [{ name: 'input', label: '依赖信息', placeholder: '如 lodash 3.x → 4.x' }],
    tags: ['依赖', '升级'],
  },
  {
    id: 'doc-gen',
    label: '写文档',
    description: '生成结构化技术文档',
    icon: 'description',
    phase: 'coding',
    template: `请为以下代码/模块生成技术文档，包含：
1. **概述**：模块职责、在系统中的定位（1-2 句话）
2. **核心概念**：关键抽象、数据模型、术语定义
3. **API 参考**：每个公开方法/函数的签名、参数说明、返回值、示例
4. **使用示例**：3-5 个常见使用场景的完整代码示例
5. **注意事项**：已知限制、性能考量、安全注意
6. **FAQ**：3-5 个最可能被问到的问题

输出为 Markdown 格式，适合放入项目的 docs/ 目录。

代码/模块：{{input}}`,
    variables: [{ name: 'input', label: '代码/模块', placeholder: '粘贴代码或描述模块...' }],
    tags: ['文档'],
  },
  {
    id: 'readme-gen',
    label: 'README',
    description: '基于项目分析自动生成 README',
    icon: 'menu_book',
    phase: 'coding',
    template: `请为当前项目生成一份专业的 README.md，包含：
1. 项目名称和一句话描述
2. 功能特性列表（bullet points）
3. 技术栈说明
4. 快速开始（安装、配置、运行）
5. 项目结构概览（目录树 + 说明）
6. 开发指南（开发环境搭建、常用命令）
7. API/接口文档链接占位
8. 贡献指南要点
9. License

先分析项目的 package.json、目录结构和核心文件来了解项目。`,
    tags: ['文档', 'README'],
  },
  {
    id: 'sql-query',
    label: 'SQL 查询',
    description: 'SQL 编写和性能优化',
    icon: 'database',
    phase: 'coding',
    template: `请帮我编写或优化以下 SQL 查询：
1. 先分析查询涉及的表结构和索引
2. 给出查询语句（遵循项目的 SQL 风格）
3. 分析 EXPLAIN/执行计划
4. 建议需要添加的索引及创建语句
5. 预估不同数据量下的性能（百万级/千万级）
6. 如果是写操作，分析锁的影响范围

需求：{{input}}`,
    variables: [{ name: 'input', label: '查询需求', placeholder: '描述要实现的 SQL 查询...' }],
    tags: ['SQL', '数据库'],
  },
  {
    id: 'data-migration',
    label: '数据迁移',
    description: '安全可靠的数据迁移方案',
    icon: 'transform',
    phase: 'coding',
    template: `请帮我设计数据迁移方案：
1. 分析源数据和目标数据的结构差异
2. 编写迁移脚本（支持幂等执行，可重复运行）
3. 数据清洗规则（去重、格式转换、默认值填充）
4. 迁移前的数据校验查询
5. 迁移后的数据完整性验证
6. 回滚方案（迁移失败时如何恢复）
7. 分批迁移策略（大数据量时避免锁表）

迁移需求：{{input}}`,
    variables: [{ name: 'input', label: '迁移需求', placeholder: '描述数据迁移场景...' }],
    tags: ['数据', '迁移'],
  },

  // ════════════════════════════════════════════
  //  Debugging — 调试排错
  // ════════════════════════════════════════════
  {
    id: 'debug',
    label: '调试分析',
    description: '结构化错误分析和排查方案',
    icon: 'bug_report',
    phase: 'debugging',
    template: `我遇到了以下错误/异常，请帮我系统化分析：

## 错误信息
\`\`\`
{{error}}
\`\`\`

## 复现步骤
{{steps}}

## 已尝试的排查
{{tried}}

请按以下步骤分析：
1. **错误解读**：逐行解析错误信息的含义
2. **根因定位**：最可能的 2-3 个原因，按概率排序
3. **排查方案**：每个原因对应的验证方法（加日志/断点/查询）
4. **修复方案**：具体的代码修改建议
5. **预防措施**：如何避免同类问题再次发生`,
    variables: [
      { name: 'error', label: '错误信息', placeholder: '粘贴完整错误信息...' },
      { name: 'steps', label: '复现步骤', placeholder: '1. 打开页面\n2. 点击...' },
      { name: 'tried', label: '已尝试的排查', placeholder: '- 重启服务\n- 检查日志...' },
    ],
    tags: ['调试', '错误'],
  },
  {
    id: 'concurrency-debug',
    label: '并发排查',
    description: '并发竞态条件分析和修复',
    icon: 'sync_problem',
    phase: 'debugging',
    template: `请分析以下并发/竞态相关的问题：
1. 识别共享可变状态的位置
2. 分析可能的竞态条件（race condition）时序
3. 评估锁/事务的粒度是否合适
4. 检查死锁可能性
5. 给出线程安全的修复方案

问题描述/代码：{{input}}`,
    variables: [{ name: 'input', label: '问题描述', placeholder: '描述并发问题、模块名或代码...' }],
    tags: ['并发', '竞态'],
  },

  // ════════════════════════════════════════════
  //  Testing — 测试
  // ════════════════════════════════════════════
  {
    id: 'unit-test',
    label: '写测试',
    description: '全面覆盖的单元测试生成',
    icon: 'science',
    phase: 'testing',
    template: `请为以下代码编写完整的单元测试，要求：
1. 使用项目已有的测试框架（先查看项目中的测试文件确认框架和风格）
2. 覆盖所有正常路径（happy path）
3. 覆盖边界条件（空值、零值、最大值、空集合等）
4. 覆盖错误路径（异常输入、网络失败、权限不足等）
5. Mock 外部依赖（数据库、API、文件系统等）
6. 每个测试用例的命名要描述被测试的行为
7. 测试之间互相独立，不共享可变状态

目标代码：{{code}}`,
    variables: [{ name: 'code', label: '测试目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['测试', '单元测试'],
  },

  // ════════════════════════════════════════════
  //  Performance — 性能
  // ════════════════════════════════════════════
  {
    id: 'perf-analysis',
    label: '性能分析',
    description: '多维度性能瓶颈分析',
    icon: 'speed',
    phase: 'performance',
    template: `请分析以下代码/接口的性能问题：

1. **时间复杂度分析**：逐段分析算法复杂度
2. **空间复杂度分析**：内存使用和分配模式
3. **数据库查询分析**：N+1 查询、缺失索引、全表扫描
4. **网络/IO 分析**：不必要的串行请求、缺失缓存
5. **渲染性能**（如适用）：不必要的重渲染、大列表、图片加载

优化建议按「收益/成本比」排序，优先推荐投入产出比最高的方案。

问题代码/接口：{{input}}`,
    variables: [{ name: 'input', label: '性能瓶颈', placeholder: '模块名、文件路径或代码...' }],
    tags: ['性能', '优化'],
  },

  // ════════════════════════════════════════════
  //  Security — 安全
  // ════════════════════════════════════════════
  {
    id: 'security-audit',
    label: '安全审查',
    description: 'OWASP 安全审查清单',
    icon: 'security',
    phase: 'security',
    template: `请对以下代码进行安全审查，覆盖 OWASP Top 10 中的相关项：
1. **注入攻击**：SQL 注入、XSS、命令注入、模板注入
2. **认证/授权**：越权访问、token 管理、会话固定
3. **数据泄露**：敏感信息暴露、日志泄密、错误信息泄露
4. **输入验证**：类型强转、边界值、特殊字符处理
5. **依赖安全**：已知漏洞的第三方库

对每个发现标注风险等级（Critical/High/Medium/Low）并给出修复代码。

审查目标：{{input}}`,
    variables: [{ name: 'input', label: '审查目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['安全', 'OWASP'],
  },
  {
    id: 'sql-injection',
    label: 'SQL 注入检查',
    description: 'SQL 注入风险专项检查',
    icon: 'gpp_maybe',
    phase: 'security',
    template: `请检查以下代码中的 SQL 注入风险：
1. 是否所有 SQL 查询都使用参数化查询/预编译语句
2. 是否存在字符串拼接 SQL 的情况
3. 动态表名/列名的处理是否安全
4. ORM 的 raw query 是否正确转义
5. 批量操作的输入是否经过验证

对每个风险点给出安全的替代写法。

检查目标：{{input}}`,
    variables: [{ name: 'input', label: '检查目标', placeholder: '模块名、文件路径或代码...' }],
    tags: ['安全', 'SQL注入'],
  },

  // ════════════════════════════════════════════
  //  Release — 发布
  // ════════════════════════════════════════════
  {
    id: 'git-commit',
    label: 'Git Commit',
    description: '自动生成规范的 commit message',
    icon: 'commit',
    phase: 'release',
    template: `请根据当前 git diff 生成规范的 commit message：
1. 遵循 Conventional Commits 格式（type(scope): description）
2. type 使用：feat/fix/refactor/docs/style/test/chore/perf/ci
3. scope 根据修改的模块自动判断
4. description 用中文，简洁描述「做了什么」和「为什么」
5. 如果是 Breaking Change，在 footer 中标注
6. 如果修改量大，生成 body 列出主要变更点`,
    tags: ['Git', '提交'],
  },
  {
    id: 'git-history',
    label: 'Git 历史分析',
    description: '从 git 历史发现代码热点和问题',
    icon: 'history_toggle_off',
    phase: 'release',
    template: `请分析以下文件/模块的 git 变更历史：
1. 高频修改的文件（哪些文件最不稳定）
2. 变更模式（是 bug fix 多还是 feature 多）
3. 主要贡献者和修改热点
4. 是否存在反复修改同一处代码的情况（可能需要重构）
5. 建议的代码 ownership 划分

分析范围：{{input}}`,
    variables: [{ name: 'input', label: '分析范围', placeholder: '如 src/api/, src/features/auth/' }],
    tags: ['Git', '历史'],
  },
  {
    id: 'changelog',
    label: 'CHANGELOG',
    description: '从 git log 生成规范的变更日志',
    icon: 'history',
    phase: 'release',
    template: `请根据最近的 git 提交记录生成 CHANGELOG，要求：
1. 遵循 Keep a Changelog 格式
2. 按 Added / Changed / Fixed / Removed 分类
3. 每条变更关联对应的 commit hash
4. 合并相似的提交为一条清晰的变更说明
5. 突出 Breaking Changes 并标注迁移指南

查看最近的 git log：`,
    tags: ['Git', '变更日志'],
  },
];

/** All unique phases that have at least one template */
export const ACTIVE_PHASES: PromptPhase[] = Array.from(
  new Set(PROMPT_TEMPLATES.map(t => t.phase))
).sort((a, b) => PHASE_META[a].order - PHASE_META[b].order);
