import { Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './shared/ErrorBoundary';
import MainLayout from './shared/MainLayout';
import ProjectsPage from './features/projects/ProjectsPage';
import ProjectDetailPage from './features/projects/ProjectDetailPage';
import DependencyGraphPage from './features/projects/DependencyGraphPage';
import GitDashboardPage from './features/git/GitDashboardPage';
import DataScreenPage from './features/data-screen/DataScreenPage';
import TimelinePage from './features/timeline/TimelinePage';
import SettingsPage from './features/settings/SettingsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="graph" element={<DependencyGraphPage />} />
          <Route path="git" element={<GitDashboardPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="data-screen" element={<DataScreenPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
