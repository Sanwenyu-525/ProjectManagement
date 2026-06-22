import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ErrorBoundary from './shared/ErrorBoundary';

// Lazy-load MainLayout to defer antd (942KB) from initial chunk
const MainLayout = lazy(() => import('./shared/MainLayout'));

const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage'));
const NewProjectWizard = lazy(() => import('./features/projects/NewProjectWizard'));

const ProjectDetailPage = lazy(() => import('./features/projects/ProjectDetailPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const TimelinePage = lazy(() => import('./features/workspace/timeline/TimelinePage'));
const DataScreenPage = lazy(() => import('./features/workspace/data-screen/DataScreenPage'));
const KnowledgeBasePage = lazy(() => import('./features/knowledge/KnowledgeBasePage'));

function PageFallback() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div className="skeleton" style={{ width: 200, height: 20, margin: '0 auto 12px' }} />
      <div className="skeleton" style={{ width: 140, height: 16, margin: '0 auto' }} />
    </div>
  );
}

function LayoutFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--md-surface)',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: 'linear-gradient(135deg, var(--md-primary), var(--md-primary-container))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        <img src="/icon.png" alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-sans)' }}>
        加载中...
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LayoutFallback />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/workspace" replace />} />
            <Route path="workspace" element={null} />
            <Route path="projects" element={<Suspense fallback={<PageFallback />}><ProjectsPage /></Suspense>} />
            <Route path="projects/new" element={<Suspense fallback={<PageFallback />}><NewProjectWizard /></Suspense>} />
            <Route element={<Suspense fallback={<PageFallback />}><Outlet /></Suspense>}>
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="data-screen" element={<DataScreenPage />} />
              <Route path="knowledge" element={<KnowledgeBasePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
