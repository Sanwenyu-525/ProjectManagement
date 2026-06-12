// Base types
export type UUID = string;
export type ISODateTime = string;
export type JSONString = string;

// Project status enum
export type ProjectStatus = 'Idea' | 'Planning' | 'Active' | 'Completed' | 'Archived';
export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ProjectSource = 'Local' | 'GitHub' | 'GitLab' | 'Gitee' | 'Bitbucket';
export type IconType = 'Auto' | 'Emoji' | 'Initial' | 'URL';

// Task status enum
export type TaskStatus = 'Todo' | 'InProgress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

// Document type
export type DocumentType = 'Doc' | 'Note' | 'README' | 'API' | 'Architecture';

// Milestone status
export type MilestoneStatus = 'Pending' | 'InProgress' | 'Completed';

// Health status
export type HealthStatus = 'healthy' | 'needs_attention' | 'critical';

// Runtime status
export type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'error';

// Tag color presets
export const TAG_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#14B8A6', // Teal
] as const;

export type TagColor = typeof TAG_COLORS[number];

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
}

export interface ProjectWithStats extends Project {
  taskCount: number;
  docCount: number;
  repoCount: number;
}

export interface ProjectDetail extends ProjectWithStats {
  repos: RemoteRepo[];
  milestones: Milestone[];
  tags: Tag[];
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
  hasChanges: boolean;
  error?: string;
}

export interface OutdatedDep {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

export interface HealthCheckSummary {
  results: ProjectHealthResult[];
  changedProjects: string[];
}

// ==================== View Models ====================

export interface ProjectViewModel extends ProjectWithStats {
  // Runtime status
  frontendStatus: RuntimeStatus;
  backendStatus: RuntimeStatus;
  lastLaunchTime?: ISODateTime;

  // Health
  healthScore?: number;
  healthStatus?: HealthStatus;
  hasUncommittedChanges?: boolean;

  // Computed
  daysSinceLastUpdate?: number;
  isOverdue?: boolean;
}

// ==================== Input Types ====================

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

// ==================== API Response Types ====================

export type ApiResponse<T> = Promise<T>;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Detect ====================

export interface DetectedProject {
  path: string;
  name: string;
  techStack: string[];
  hasGit: boolean;
  frameworks: string[];
  openCommand?: string;
  frontendCommand?: string;
  backendCommand?: string;
}

export interface ScanResult {
  projects: DetectedProject[];
  monorepoRoot?: string;
}
