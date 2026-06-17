import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ErrorBoundary from './shared/ErrorBoundary';
import MainLayout from './shared/MainLayout';
import ProjectsPage from './features/projects/ProjectsPage';
import NewProjectWizard from './features/projects/NewProjectWizard';

const ProjectDetailPage = lazy(() => import('./features/projects/ProjectDetailPage'));
const DependencyGraphPage = lazy(() => import('./features/projects/DependencyGraphPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const TimelinePage = lazy(() => import('./features/workspace/timeline/TimelinePage'));
const DataScreenPage = lazy(() => import('./features/workspace/data-screen/DataScreenPage'));

function PageFallback() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ width: 200, height: 20, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 12px' }} />
      <div style={{ width: 140, height: 16, background: '#e5e7eb', borderRadius: 4, margin: '0 auto' }} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/workspace" replace />} />
          <Route path="workspace" element={null} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<NewProjectWizard />} />
          <Route element={<Suspense fallback={<PageFallback />}><Outlet /></Suspense>}>
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="graph" element={<DependencyGraphPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="data-screen" element={<DataScreenPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
