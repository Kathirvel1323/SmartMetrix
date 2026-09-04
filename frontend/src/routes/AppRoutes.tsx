import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { InstrumentsPage } from '../pages/instruments/InstrumentsPage';
import { VerificationPage } from '../pages/verifications/VerificationPage';
import { InspectionsPage } from '../pages/inspections/InspectionsPage';
import { RiskIntelligencePage } from '../pages/risk/RiskIntelligencePage';
import { RegionalIntelligencePage } from '../pages/regional/RegionalIntelligencePage';
import { CertificatesPage } from '../pages/certificates/CertificatesPage';
import { NoticesPage } from '../pages/notices/NoticesPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { LoadingState } from '../components/ui/LoadingState';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Array<'ADMIN' | 'INSPECTOR' | 'OWNER'>;
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingState message="Authenticating session with SmartMetrix API..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/instruments" element={<InstrumentsPage />} />
        <Route path="/verifications" element={<VerificationPage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route
          path="/risk"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <RiskIntelligencePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/regional"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <RegionalIntelligencePage />
            </ProtectedRoute>
          }
        />
        <Route path="/passport" element={<CertificatesPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
