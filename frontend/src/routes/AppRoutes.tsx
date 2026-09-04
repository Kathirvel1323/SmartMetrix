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
import { AnomalyPage } from '../pages/anomaly/AnomalyPage';

// Batch 2 New Pages
import { PublicVerifyPage } from '../pages/public/PublicVerifyPage';
import { PublicComplaintPage } from '../pages/public/PublicComplaintPage';
import { TrackComplaintPage } from '../pages/public/TrackComplaintPage';
import { DigitalPassportPage } from '../pages/passport/DigitalPassportPage';
import { ComplaintsPage } from '../pages/complaints/ComplaintsPage';
import { SearchPage } from '../pages/search/SearchPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { DecisionSupportPage } from '../pages/decision-support/DecisionSupportPage';

import { NotFoundPage } from '../pages/NotFoundPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
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
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Unauthenticated Public Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify/:publicVerificationId" element={<PublicVerifyPage />} />
      <Route path="/public/complaint" element={<PublicComplaintPage />} />
      <Route path="/public/complaints/new" element={<PublicComplaintPage />} />
      <Route path="/public/complaints/track" element={<TrackComplaintPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Protected App Layout Routes */}
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
        <Route path="/passport" element={<DigitalPassportPage />} />
        <Route path="/passport/:instrumentId" element={<DigitalPassportPage />} />
        <Route path="/certificates" element={<CertificatesPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route
          path="/anomaly"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <AnomalyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route
          path="/audit"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/decision-support"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'INSPECTOR']}>
              <DecisionSupportPage />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
