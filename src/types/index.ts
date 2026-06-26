// Base types
export type UUID = string;
export type ISODateTime = string;
export type JSONString = string;

// Project status enum
export type ProjectStatus = 'Idea' | 'Planning' | 'Active' | 'Completed' | 'Archived';
export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ProjectSource = 'Local' | 'GitHub' | 'GitLab' | 'Gitee' | 'Bitbucket';
export type IconType = 'Auto' | 'Emoji' | 'Initial' | 'URL' | 'Custom';

// Task status enum
export type TaskStatus = 'Todo' | 'InProgress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

// Document type
export type DocumentType = 'Doc' | 'Note' | 'README' | 'API' | 'Architecture';

// Milestone status
export type MilestoneStatus = 'Pending' | 'InProgress' | 'Completed';

// Runtime status
export type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'error';

// ==================== Core Entities ====================

export interface Project {
  id: UUID;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  source: ProjectSource;
  localPath?: string;
  openCommand?: string;
  frontendCommand?: string;
  backendCommand?: string;
  frontendCwd?: string;
  backendCwd?: string;
  liveUrl?: string;
  domainName?: string;
  techStack: string[];
  startDate?: ISODateTime;
  targetDate?: ISODateTime;
  iconType: IconType;
  iconUrl?: string;
  iconColor?: string;
  frontendStatus: RuntimeStatus;
  backendStatus: RuntimeStatus;
  lastLaunchTime?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime;
}

export interface ProjectWithStats extends Project {
  taskCount: number;
  completedTaskCount: number;
  docCount: number;
  repoCount: number;
}

export interface ProjectDetail extends ProjectWithStats {
  remoteRepos: RemoteRepo[];
  milestones: Milestone[];
  tags: Tag[];
  _count?: Record<string, number>;
}

export interface Task {
  id: UUID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: ISODateTime;
  projectId: UUID;
  repoScope?: UUID;
  milestoneId?: UUID;
  parentId?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TaskWithProject extends Task {
  projectName: string;
}

export interface RemoteRepo {
  id: UUID;
  projectId: UUID;
  platform: string;
  repoUrl: string;
  repoFullName: string;
  defaultBranch?: string;
  repoStatus: string;
  lastCommitSha?: string;
  lastCommitAt?: ISODateTime;
  lastSyncAt?: ISODateTime;
  extraConfig?: JSONString;
  integrationId?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// Git types
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branchIdx: number;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

export interface GitLogResult {
  commits: GitCommit[];
  branches: GitBranchInfo[];
}

export interface Milestone {
  id: UUID;
  name: string;
  description?: string;
  dueDate?: ISODateTime;
  status: MilestoneStatus;
  projectId: UUID;
  createdAt: ISODateTime;
}

export interface Document {
  id: UUID;
  title: string;
  content: string;
  type: DocumentType;
  projectId: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Tag {
  id: UUID;
  name: string;
  color: string;
  projectCount?: number;
}

export interface ActivityLog {
  id: UUID;
  action: string;
  entityType: string;
  entityId: UUID;
  details?: JSONString;
  projectId: UUID;
  projectName?: string;
  createdAt: ISODateTime;
}

// ==================== Health Check ====================

export interface HealthCheckResult {
  id: UUID;
  projectId: UUID;
  checkDate: string;
  dirtyFileCount: number;
  currentBranch?: string;
  aheadCount: number;
  behindCount: number;
  outdatedDeps: string;
  outdatedDepCount: number;
  vulnerabilityCount: number;
  vulnerabilities: string;
  hasChanges: boolean;
  createdAt: ISODateTime;
}

export interface ProjectHealthResult {
  projectId: UUID;
  projectName: string;
  dirtyFileCount: number;
  currentBranch?: string;
  aheadCount: number;
  behindCount: number;
  outdatedDeps: OutdatedDep[];
  outdatedDepCount: number;
  vulnerabilityCount: number;
  vulnerabilities: Vulnerability[];
  hasChanges: boolean;
  error?: string;
}

export interface Vulnerability {
  name: string;
  severity: string;
  via: string;
  fixAvailable: boolean;
}

export interface OutdatedDep {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  source?: ProjectSource;
  localPath?: string;
  openCommand?: string;
  frontendCommand?: string;
  backendCommand?: string;
  frontendCwd?: string;
  backendCwd?: string;
  liveUrl?: string;
  domainName?: string;
  techStack?: string[];
  startDate?: ISODateTime;
  targetDate?: ISODateTime;
  iconType?: IconType;
  iconUrl?: string;
  iconColor?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  source?: ProjectSource;
  localPath?: string;
  openCommand?: string;
  frontendCommand?: string;
  backendCommand?: string;
  frontendCwd?: string;
  backendCwd?: string;
  liveUrl?: string;
  domainName?: string;
  techStack?: string[];
  startDate?: ISODateTime;
  targetDate?: ISODateTime;
  iconType?: IconType;
  iconUrl?: string;
  iconColor?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: ISODateTime;
  repoScope?: UUID;
  milestoneId?: UUID;
  parentId?: UUID;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: ISODateTime;
  repoScope?: UUID;
  milestoneId?: UUID;
}

export interface CreateDocumentInput {
  title: string;
  content?: string;
  type?: DocumentType;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  type?: DocumentType;
}

export interface CreateMilestoneInput {
  name: string;
  description?: string;
  dueDate?: ISODateTime;
  status?: MilestoneStatus;
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string;
  dueDate?: ISODateTime;
  status?: MilestoneStatus;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface AddRepoInput {
  platform: string;
  repoUrl: string;
  repoFullName: string;
  defaultBranch?: string;
  repoStatus?: string;
  lastCommitSha?: string;
  lastCommitAt?: ISODateTime;
  lastSyncAt?: ISODateTime;
  extraConfig?: JSONString;
  integrationId?: UUID;
}

export interface UpdateRepoInput {
  platform?: string;
  repoUrl?: string;
  repoFullName?: string;
  defaultBranch?: string;
  repoStatus?: string;
  lastCommitSha?: string;
  lastCommitAt?: ISODateTime;
  lastSyncAt?: ISODateTime;
  extraConfig?: JSONString;
}

// ==================== Search ====================

export interface SearchResults {
  projects: ProjectWithStats[];
  tasks: TaskWithProject[];
  documents: DocumentWithProject[];
}

export interface DocumentWithProject extends Document {
  projectName: string;
}

// ==================== Detect ====================

export interface DetectedProject {
  name?: string;
  description?: string;
  techStack: string[];
  source: string;
  localPath?: string;
  repoUrl?: string;
  repoPlatform?: string;
  openCommand?: string;
  frontendCommand?: string;
  backendCommand?: string;
  gitRoot?: string;
  groupId?: string;
  parentPath?: string;
  iconType?: string;
  iconUrl?: string;
  iconColor?: string;
}

export interface ScanResult {
  projects: DetectedProject[];
  groups: ScanGroup[];
  monorepoRoot?: string;
}

// ==================== Workspaces ====================

export interface Workspace {
  id: UUID;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  projectCount?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ==================== Scan Groups ====================

export interface ScanGroup {
  id: string;
  label: string;
  groupType: 'git' | 'folder';
}

// ==================== Project Brain ====================

export interface ProjectBrain {
  structure: DirectoryNode;
  entryPoints: EntryPoints;
  directories: DirectoryInfo[];
  environment: EnvironmentInfo;
  stats: ProjectStats;
}

export interface DirectoryNode {
  name: string;
  nodeType: 'dir' | 'file';
  children: DirectoryNode[];
  fileCount: number;
}

export interface EntryPoints {
  main?: string;
  config?: string;
  test?: string;
  lint?: string;
}

export interface DirectoryInfo {
  path: string;
  purpose: 'source' | 'test' | 'config' | 'build' | 'docs' | 'assets' | 'scripts';
  fileCount: number;
  description?: string;
}

export interface EnvironmentInfo {
  nodeVersion?: string;
  pythonVersion?: string;
  requiredTools: string[];
}

export interface ProjectStats {
  totalFiles: number;
  sourceFiles: number;
  testFiles: number;
  linesOfCode?: number;
  languages: LanguageStats[];
}

export interface LanguageStats {
  name: string;
  fileCount: number;
  lines?: number;
}

// ==================== Agent Sessions ====================

export interface AgentSession {
  id: string;
  agentTabId: string;
  runtimeId: string;
  startedAt: string;
  endedAt?: string;
  status: 'running' | 'ended';
  projectId?: string;
  cwd?: string;
  providerSessionId?: string;
  permissionMode?: string;
  lastError?: string;
  exitCode?: number;
  updatedAt?: string;
  firstMessage?: string;
}

export interface AgentMessage {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'event' | 'input' | 'output';
  content: string;
  timestamp: string;
}

// ==================== Agent Tasks ====================

export interface AgentTask {
  id: string;
  sessionId: string;
  parentId: string | null;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low' | 'urgent';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Model Providers & Agent Configs ====================

export interface ModelProvider {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  icon: string;
  providerId: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  command: string | null;
  args: string | null;
  url: string | null;
  env: string | null;
  autoConnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== Browser Memory ====================

export interface BrowserVisit {
  id: string;
  tabId: string;
  url: string;
  title?: string;
  visitedAt: string;
  domAnalysis?: string;
  projectId?: string;
}

// ==================== Builds ====================

export type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface Build {
  id: string;
  projectId?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  status: BuildStatus;
  duration?: number;
  triggeredBy?: string;
  platforms: string;
  artifacts: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildLog {
  id: number;
  buildId: string;
  timestamp: string;
  level: string;
  message: string;
}

export interface CreateBuildInput {
  projectId?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  triggeredBy?: string;
  platforms?: string;
}

export interface UpdateBuildInput {
  status?: BuildStatus;
  duration?: number;
  platforms?: string;
  artifacts?: string;
}

// ==================== Templates ====================

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  tags: string;
  data: string;
  createdAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  tags?: string;
  data?: string;
}

// ==================== Integrations ====================

export interface Integration {
  id: string;
  platform: string;
  accessToken?: string;
  username?: string;
  settings: string;
  connectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationInput {
  platform: string;
  accessToken?: string;
  username?: string;
  settings?: string;
}

export interface UpdateIntegrationInput {
  accessToken?: string;
  username?: string;
  settings?: string;
}

// ==================== Memory (Knowledge Base) ====================

export type MemoryType = 'architecture' | 'code' | 'bugfix' | 'rule' | 'session' | 'decision' | 'solution' | 'pattern' | 'prompt' | 'workflow' | 'experience';
export type MemorySource = 'manual' | 'agent' | 'git' | 'task';

export interface ProjectMemory {
  id: string;
  projectId: string | null;
  type: MemoryType;
  title: string;
  content: string;
  tags: string | null;
  source: MemorySource;
  sessionId: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  projectId: string | null;
  title: string;
  reason: string;
  alternatives: string | null;
  sessionId: string | null;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string | null;
  options: string | null;
  consequences: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateMemoryInput {
  projectId?: string;
  memoryType: MemoryType;
  title: string;
  content: string;
  tags?: string;
  source?: MemorySource;
  sessionId?: string;
}

export interface CreateDecisionInput {
  projectId?: string;
  title: string;
  reason: string;
  alternatives?: string;
  sessionId?: string;
  context?: string;
  options?: string;
  consequences?: string;
  status?: Decision['status'];
}

export interface UpdateDecisionInput {
  id: string;
  title?: string;
  reason?: string;
  context?: string;
  options?: string;
  consequences?: string;
  status?: Decision['status'];
}

export interface ContextItem {
  id: string;
  source: 'memory' | 'decision';
  score: number;
  title: string;
  content: string;
  type: MemoryType;
}

export interface BuildContextResult {
  packedContext: string;
  memoryCount: number;
  decisionCount: number;
}

// ==================== Knowledge Base ====================

export interface PersonalNote {
  id: string;
  projectId: string | null;
  title: string;
  content: string;
  tags: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  projectId?: string;
  title: string;
  content?: string;
  tags?: string;
}

export interface KnowledgeItem {
  id: string;
  projectId: string | null;
  title: string;
  content: string;
  tags: string | null;
  source: 'memory' | 'decision' | 'document' | 'note';
  category: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  filePath: string | null;
}

// ==================== Project Graph ====================

export interface GraphNode {
  id: UUID;
  projectId: UUID;
  filePath: string;
  fileName: string;
  language: string;
  directory: string;
  lineCount: number;
}

export interface GraphEdge {
  id: UUID;
  projectId: UUID;
  sourceNodeId: UUID;
  targetNodeId: UUID;
  importPath: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  languageCounts: Record<string, number>;
  scanDurationMs: number;
}

export interface FileDepCount {
  filePath: string;
  fileName: string;
  count: number;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  orphanFiles: string[];
  topDependencies: FileDepCount[];
  topImporters: FileDepCount[];
  languageBreakdown: Record<string, number>;
  directoryBreakdown: Record<string, number>;
}

export interface ImpactNode {
  id: UUID;
  filePath: string;
  fileName: string;
  depth: number;
}

export interface ImpactResult {
  impactedNodes: ImpactNode[];
  directCount: number;
  indirectCount: number;
  maxDepth: number;
}

export interface ChainNode {
  id: UUID;
  filePath: string;
  fileName: string;
  depth: number;
}

export interface ChainEdge {
  sourceId: UUID;
  targetId: UUID;
}

export interface ChainResult {
  chainNodes: ChainNode[];
  chainEdges: ChainEdge[];
  maxDepth: number;
  direction: string;
}

export interface LayerNode {
  id: UUID;
  filePath: string;
  fileName: string;
}

export interface LayerInfo {
  level: number;
  nodes: LayerNode[];
}

export interface CycleInfo {
  nodeIds: UUID[];
  filePaths: string[];
}

export interface LayerResult {
  layers: LayerInfo[];
  cycles: CycleInfo[];
  totalNodes: number;
}

// ==================== Feature Groups ====================

export interface FeatureGroup {
  id: UUID;
  projectId: UUID;
  name: string;
  description?: string;
  color?: string;
  createdAt: ISODateTime;
  fileCount: number;
}

export interface GroupMembership {
  groupId: UUID;
  nodeId: UUID;
  color?: string;
}

export interface SuggestedGroup {
  name: string;
  reason: string;
  nodeIds: UUID[];
  filePaths: string[];
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  color?: string;
}

// ── Business Module Classification ──

export interface BusinessModule {
  id: string;
  name: string;
  description: string;
  fileNodeIds: string[];
  filePaths: string[];
  dependsOn: string[];
}

export interface BusinessClassification {
  modules: BusinessModule[];
  uncategorized: string[];
}

// ── Project Audit ──

export interface AuditRiskItem {
  dimension: string;
  label: string;
  severity: string; // 'warning' | 'critical'
  detail: string;
}

export interface AuditRecommendation {
  dimension: string;
  label: string;
  priority: string; // 'low' | 'medium' | 'high'
  detail: string;
}

export interface AuditItem {
  id: string;
  auditId: string;
  dimension: string;
  itemKey: string;
  label: string;
  score: number;
  maxScore: number;
  status: string; // 'good' | 'warning' | 'critical'
  details: string | null;
}

export interface ProjectAuditResult {
  id: string;
  projectId: string;
  auditDate: string;
  scoreArchitecture: number;
  scoreCodeQuality: number;
  scoreDependencies: number;
  scoreChangeImpact: number;
  scoreKnowledgeGap: number;
  totalScore: number;
  riskItems: AuditRiskItem[];
  recommendations: AuditRecommendation[];
  triggerSource: string;
  durationMs: number | null;
  items: AuditItem[];
}

export interface AuditRecord {
  id: string;
  projectId: string;
  auditDate: string;
  scoreArchitecture: number;
  scoreCodeQuality: number;
  scoreDependencies: number;
  scoreChangeImpact: number;
  scoreKnowledgeGap: number;
  totalScore: number;
  riskItems: string; // JSON
  recommendations: string; // JSON
  triggerSource: string;
  durationMs: number | null;
  createdAt: string;
}
