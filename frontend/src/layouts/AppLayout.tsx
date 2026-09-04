import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/ui/Logo';
import {
  LayoutDashboard,
  Scale,
  ClipboardCheck,
  ShieldCheck,
  BrainCircuit,
  Map,
  FileCheck2,
  AlertOctagon,
  FileText,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ChevronDown,
  Zap,
  Search,
  Award,
  MessageSquareWarning,
  History,
  Brain,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Instruments', path: '/instruments', icon: Scale, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Verification', path: '/verifications', icon: ClipboardCheck, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Inspections', path: '/inspections', icon: ShieldCheck, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Digital Passport', path: '/passport', icon: FileCheck2, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Certificates', path: '/certificates', icon: Award, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Complaints', path: '/complaints', icon: MessageSquareWarning, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Risk Intelligence', path: '/risk', icon: BrainCircuit, roles: ['ADMIN', 'INSPECTOR'] },
    { label: 'Anomaly Intelligence', path: '/anomaly', icon: Zap, roles: ['ADMIN', 'INSPECTOR'] },
    { label: 'Regional Map', path: '/regional', icon: Map, roles: ['ADMIN', 'INSPECTOR'] },
    { label: 'AI Decision Support', path: '/decision-support', icon: Brain, roles: ['ADMIN', 'INSPECTOR'] },
    { label: 'Improvement Notices', path: '/notices', icon: AlertOctagon, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Global Search', path: '/search', icon: Search, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Audit Trail', path: '/audit', icon: History, roles: ['ADMIN'] },
    { label: 'Reports', path: '/reports', icon: FileText, roles: ['ADMIN', 'INSPECTOR'] },
    { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['ADMIN', 'INSPECTOR', 'OWNER'] },
  ];

  const filteredNav = navItems.filter((item) => !user || item.roles.includes(user.role));

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'INSPECTOR':
        return 'bg-teal-950/80 text-teal-300 border-teal-500/40';
      case 'OWNER':
        return 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Header branding */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <Logo />
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600/30 to-teal-500/10 text-teal-400 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 font-semibold text-xs border border-slate-600">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col truncate text-left">
                <span className="text-xs font-bold text-slate-200 truncate">{user?.name || 'User'}</span>
                <span className="text-[10px] text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-slate-950">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="text-slate-200 font-bold tracking-wide uppercase text-[11px]">
                SmartMetrix Security Portal
              </span>
              <span>•</span>
              <span className="text-teal-400 font-mono text-[11px]">STATUTORY ENFORCEMENT ENGINE</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/notifications"
              className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-400 rounded-full animate-ping"></span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-400 rounded-full"></span>
            </Link>

            {/* Role Badge */}
            {user && (
              <span
                className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wider uppercase ${getRoleBadgeColor(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            )}

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium"
              >
                <UserIcon className="w-4 h-4 text-teal-400" />
                <span className="hidden md:inline">{user?.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-bold text-slate-100">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/40 flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
