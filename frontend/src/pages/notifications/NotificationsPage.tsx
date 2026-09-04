import React, { useState, useEffect } from 'react';
import { notificationService } from '../../services/notification.service';
import type { NotificationItem } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { Bell, CheckCircle2 } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res || []);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // Ignore
    }
  };

  if (isLoading) return <LoadingState message="Loading Smart Notifications..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart System Notifications"
        subtitle="Recipient-isolated alerts for verification due dates, high-risk instruments & enforcement actions."
        breadcrumbs={[{ label: 'SmartMetrix' }, { label: 'Notifications' }]}
      />

      <Card title="Alert Feed" subtitle="Real-time notifications targeted specifically to your user account">
        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {notifications.map((n) => (
              <div key={n._id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100">{n.title}</h4>
                    {!n.isRead && <Badge variant="pending">UNREAD</Badge>}
                  </div>
                  <p className="text-xs text-slate-300">{n.message}</p>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(n._id)}
                    className="p-1.5 text-xs text-teal-400 hover:bg-slate-800 rounded-lg flex items-center gap-1 font-semibold border border-teal-500/30 shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No new notifications in your inbox.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
