import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarCheck,
  BedDouble,
  MessageSquareWarning,
  Users,
  CreditCard,
  FileBarChart2,
  History,
  ShieldCheck,
  UserCheck,
  UserCog,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';
import { Badge } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';

export function BauhausMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="32" height="32" fill="#FFFDF7" stroke="#171717" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="6" fill="#E94235" stroke="#171717" strokeWidth="2" />
      <rect x="19" y="6" width="11" height="11" fill="#2454D8" stroke="#171717" strokeWidth="2" />
      <polygon points="6,30 18,19 30,30" fill="#F4C542" stroke="#171717" strokeWidth="2" />
    </svg>
  );
}

function getNavForRole(role) {
  const common = [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard }];

  if (role === 'Student') {
    return [
      ...common,
      { to: '/hostels', label: 'Hostels & Beds', icon: Building2 },
      { to: '/bookings', label: 'My Bookings', icon: CalendarCheck },
      { to: '/complaints', label: 'Complaints', icon: MessageSquareWarning },
      { to: '/visitors', label: 'Visitors', icon: UserCheck },
      { to: '/payments', label: 'My Payments', icon: CreditCard },
      { to: '/profile', label: 'Profile', icon: UserCog },
    ];
  }

  if (role === 'Warden') {
    return [
      ...common,
      { to: '/bookings', label: 'Review Bookings', icon: CalendarCheck },
      { to: '/allocations', label: 'Bed Allocations', icon: BedDouble },
      { to: '/hostels', label: 'Check Availability', icon: Building2 },
      { to: '/complaints', label: 'Manage Complaints', icon: MessageSquareWarning },
      { to: '/visitors', label: 'Manage Visitors', icon: UserCheck },
      { to: '/history', label: 'Historical Search', icon: History },
      { to: '/profile', label: 'Profile', icon: UserCog },
    ];
  }

  if (role === 'Administrator') {
    return [
      ...common,
      { to: '/admin/inventory', label: 'Manage Inventory', icon: Building2 },
      { to: '/admin/users', label: 'Users & Roles', icon: Users },
      { to: '/bookings', label: 'All Bookings', icon: CalendarCheck },
      { to: '/allocations', label: 'Allocations', icon: BedDouble },
      { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
      { to: '/reports', label: 'Reports', icon: FileBarChart2 },
      { to: '/history', label: 'Historical Search', icon: History },
      { to: '/profile', label: 'Profile', icon: UserCog },
    ];
  }

  if (role === 'AccountsPersonnel') {
    return [
      ...common,
      { to: '/payments', label: 'Payment Records', icon: CreditCard },
      { to: '/reports', label: 'Reports', icon: FileBarChart2 },
      { to: '/bookings', label: 'Booking Ledger', icon: CalendarCheck },
      { to: '/hostels', label: 'Hostels', icon: Building2 },
      { to: '/profile', label: 'Profile', icon: UserCog },
    ];
  }

  // HostelManagement
  return [
    ...common,
    { to: '/reports', label: 'Reports', icon: FileBarChart2 },
    { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
    { to: '/history', label: 'Historical Search', icon: History },
    { to: '/bookings', label: 'Bookings View', icon: CalendarCheck },
    { to: '/hostels', label: 'Hostels', icon: Building2 },
    { to: '/profile', label: 'Profile', icon: UserCog },
  ];
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getNavForRole(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside
        className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="row-between">
          <div className="app-brand" style={{ flex: 1 }}>
            <BauhausMark size={32} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>
                HOSTEL SAD
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Booking System
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={18} strokeWidth={2} />
          </Button>
        </div>

        <nav className="app-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: 'auto',
            borderTop: '2px solid var(--border-color)',
            paddingTop: 12,
          }}
          className="stack-sm"
        >
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
            <Badge status={user?.role} />
            <span className="mono muted">#{user?.userId}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.fullName}</div>
          {user?.assignedHostelId && (
            <div style={{ fontSize: 12 }} className="muted">
              Assigned: {user.assignedHostelId.hostelName}
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2} /> Log Out
          </Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="row-wrap">
            <Button
              variant="secondary"
              size="sm"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} strokeWidth={2} /> Menu
            </Button>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
              HOSTEL BOOKING AND MANAGEMENT SYSTEM
            </div>
          </div>

          <div className="row-wrap">
            <span className="mono">{user?.username}</span>
            <Badge status={user?.role} />
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
