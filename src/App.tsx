import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ErrorBoundary from './shared/ErrorBoundary';
import MainLayout from './shared/MainLayout';
import ProjectsPage from './features/projects/ProjectsPage';

// Lazy-load heavy/rarely-visited pages to reduce initial bundle
const ProjectDetailPage = lazy(() => import('./features/projects/ProjectDetailPage'));
const DependencyGraphPage = lazy(() => import('./features/projects/DependencyGraphPage'));
const GitDashboardPage = lazy(() => import('./features/git/GitDashboardPage'));
const DataScreenPage = lazy(() => import('./features/data-screen/DataScreenPage'));
const TimelinePage = lazy(() => import('./features/timeline/TimelinePage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

const PageFallback = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
    <div className="skeleton" style={{ width: 200, height: 24 }} />
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="projects" element={<ProjectsPage />} />
          <Route element={<Suspense fallback={PageFallback}><Outlet /></Suspense>}>
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="graph" element={<DependencyGraphPage />} />
            <Route path="git" element={<GitDashboardPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="data-screen" element={<DataScreenPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
