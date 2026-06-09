import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from './stores/authStore';
import MainLayout from './shared/MainLayout';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ProjectsPage from './features/projects/ProjectsPage';
import ProjectDetailPage from './features/projects/ProjectDetailPage';
import DataScreenPage from './features/data-screen/DataScreenPage';
import TimelinePage from './features/timeline/TimelinePage';
import SettingsPage from './features/settings/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, fetchUser } = useAuthStore();

  useEffect(() => {
    if (token) fetchUser();
  }, [token]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="data-screen" element={<DataScreenPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
