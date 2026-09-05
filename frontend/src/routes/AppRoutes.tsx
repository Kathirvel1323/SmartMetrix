import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { PublicVerifyPage } from '../pages/public/PublicVerifyPage';
import { PublicComplaintPage } from '../pages/public/PublicComplaintPage';
import { TrackComplaintPage } from '../pages/public/TrackComplaintPage';

import { NotFoundPage } from '../pages/NotFoundPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { LoadingState } from '../components/ui/LoadingState';

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const InstrumentsPage = lazy(() => import('../pages/instruments/InstrumentsPage').then((module) => ({ default: module.InstrumentsPage })));
const VerificationPage = lazy(() => import('../pages/verifications/VerificationPage').then((module) => ({ default: module.VerificationPage })));
const InspectionsPage = lazy(() => import('../pages/inspections/InspectionsPage').then((module) => ({ default: module.InspectionsPage })));
const RiskIntelligencePage = lazy(() => import('../pages/risk/RiskIntelligencePage').then((module) => ({ default: module.RiskIntelligencePage })));
const RegionalIntelligencePage = lazy(() => import('../pages/regional/RegionalIntelligencePage').then((module) => ({ default: module.RegionalIntelligencePage })));
const CertificatesPage = lazy(() => import('../pages/certificates/CertificatesPage').then((module) => ({ default: module.CertificatesPage })));
const NoticesPage = lazy(() => import('../pages/notices/NoticesPage').then((module) => ({ default: module.NoticesPage })));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AnomalyPage = lazy(() => import('../pages/anomaly/AnomalyPage').then((module) => ({ default: module.AnomalyPage })));
const DigitalPassportPage = lazy(() => import('../pages/passport/DigitalPassportPage').then((module) => ({ default: module.DigitalPassportPage })));
const ComplaintsPage = lazy(() => import('../pages/complaints/ComplaintsPage').then((module) => ({ default: module.ComplaintsPage })));
const SearchPage = lazy(() => import('../pages/search/SearchPage').then((module) => ({ default: module.SearchPage })));
const AuditPage = lazy(() => import('../pages/audit/AuditPage').then((module) => ({ default: module.AuditPage })));
const DecisionSupportPage = lazy(() => import('../pages/decision-support/DecisionSupportPage').then((module) => ({ default: module.DecisionSupportPage })));

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
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <LoadingState message="Loading SmartMetrix module..." />
        </div>
      }
    >
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
    </Suspense>
  );
};
