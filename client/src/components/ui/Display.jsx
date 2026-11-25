import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export function Card({ accent, featured = false, className = '', children, ...props }) {
  return (
    <section
      className={`nb-card ${featured ? 'nb-card-featured' : ''} ${className}`.trim()}
      {...props}
    >
      {accent && <div className={`nb-card-strip nb-card-strip-${accent}`} aria-hidden="true" />}
      {children}
    </section>
  );
}

const STATUS_TONE = {
  // Booking / Allocation / Bed
  Pending: 'yellow',
  Approved: 'green',
  Completed: 'blue',
  Rejected: 'red',
  Cancelled: 'neutral',
  Active: 'green',
  CheckedIn: 'blue',
  CheckedOut: 'neutral',
  Released: 'neutral',
  Available: 'green',
  Reserved: 'yellow',
  Occupied: 'blue',
  Maintenance: 'red',
  Operational: 'green',
  UnderMaintenance: 'red',
  OutOfService: 'red',
  Full: 'yellow',
  Inactive: 'neutral',
  Suspended: 'red',
  // Complaints / Visitors / Payments
  Open: 'red',
  InProgress: 'yellow',
  Resolved: 'green',
  Closed: 'neutral',
  Registered: 'yellow',
  Paid: 'green',
  Failed: 'red',
  Refunded: 'ink',
  // Roles
  Student: 'blue',
  Warden: 'yellow',
  Administrator: 'red',
  AccountsPersonnel: 'green',
  HostelManagement: 'ink',
};

export function Badge({ status, tone, children }) {
  const resolved = tone || STATUS_TONE[status] || 'neutral';
  return <span className={`nb-badge nb-badge-${resolved}`}>{children || status}</span>;
}

export function Alert({ variant = 'info', children, className = '' }) {
  const Icon =
    variant === 'error'
      ? AlertCircle
      : variant === 'success'
        ? CheckCircle2
        : variant === 'warning'
          ? AlertTriangle
          : Info;

  return (
    <div
      className={`nb-alert nb-alert-${variant} ${className}`.trim()}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}
