import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { InspectorDashboard } from './InspectorDashboard';
import { OwnerDashboard } from './OwnerDashboard';
import { PageHeader } from '../../components/ui/PageHeader';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const getDashboardSubtitle = () => {
    switch (user?.role) {
      case 'ADMIN':
        return 'State-wide legal metrology monitoring, risk intelligence & system controls.';
      case 'INSPECTOR':
        return 'Field inspection queue, scheduling & verification tasks.';
      case 'OWNER':
        return 'Establishment asset compliance, digital passports & verification history.';
      default:
        return 'Legal Metrology Command Center Portal.';
    }
  };

  return (
    <div>
      <PageHeader
        title={`${user?.role || 'System'} Command Dashboard`}
        subtitle={getDashboardSubtitle()}
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Dashboard' }]}
      />

      {user?.role === 'ADMIN' && <AdminDashboard />}
      {user?.role === 'INSPECTOR' && <InspectorDashboard />}
      {user?.role === 'OWNER' && <OwnerDashboard />}
      {!user?.role && <AdminDashboard />}
    </div>
  );
};
