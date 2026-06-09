import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截：自动加 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('devhub_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401 自动跳登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('devhub_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ==================== Auth ====================

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// ==================== Projects ====================

export const projectsApi = {
  list: (params?: Record<string, string>) => api.get('/projects', { params }),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/projects/${id}/status`, { status }),
  getStats: (id: string) => api.get(`/projects/${id}/stats`),
  open: (id: string) => api.post(`/projects/${id}/open`),
};

// ==================== Tasks ====================

export const tasksApi = {
  list: (projectId: string, params?: Record<string, string>) =>
    api.get(`/projects/${projectId}/tasks`, { params }),
  create: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/tasks`, data),
  update: (id: string, data: any) => api.patch(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tasks/${id}/status`, { status }),
};

// ==================== Repos ====================

export const reposApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/repos`),
  add: (projectId: string, data: any) => api.post(`/projects/${projectId}/repos`, data),
  update: (id: string, data: any) => api.patch(`/repos/${id}`, data),
  remove: (id: string) => api.delete(`/repos/${id}`),
  sync: (id: string) => api.post(`/repos/${id}/sync`),
};

// ==================== Timeline ====================

export const timelineApi = {
  list: (params?: { limit?: number; offset?: number; projectId?: string }) =>
    api.get('/timeline', { params }),
  byProject: (projectId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/projects/${projectId}/timeline`, { params }),
};

// ==================== Search ====================

export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
};

// ==================== Tags ====================

export const tagsApi = {
  list: () => api.get('/tags'),
  create: (data: { name: string; color?: string }) => api.post('/tags', data),
  update: (id: string, data: any) => api.patch(`/tags/${id}`, data),
  delete: (id: string) => api.delete(`/tags/${id}`),
  assignToProject: (projectId: string, tagId: string) => api.post(`/projects/${projectId}/tags`, { tagId }),
  removeFromProject: (projectId: string, tagId: string) => api.delete(`/projects/${projectId}/tags/${tagId}`),
};

// ==================== Milestones ====================

export const milestonesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/milestones`),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/milestones`, data),
  update: (id: string, data: any) => api.patch(`/milestones/${id}`, data),
  delete: (id: string) => api.delete(`/milestones/${id}`),
};

export const documentsApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/documents`),
  create: (projectId: string, data: any) => api.post(`/projects/${projectId}/documents`, data),
  getById: (id: string) => api.get(`/documents/${id}`),
  update: (id: string, data: any) => api.patch(`/documents/${id}`, data),
  delete: (id: string) => api.delete(`/documents/${id}`),
};
