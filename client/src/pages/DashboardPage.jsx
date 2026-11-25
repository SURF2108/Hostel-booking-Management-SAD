import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarCheck, ClipboardList, ShieldCheck } from 'lucide-react';
import { apiFetch, formatCurrencyINR, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Badge, Card } from '../components/ui/Display.jsx';
import { ErrorState, SkeletonGrid } from '../components/ui/DataStates.jsx';

function StatCard({ label, value, accent = 'blue', sub }) {
  return (
    <div className="col-4">
      <Card accent={accent}>
        <div className="stack-sm" style={{ paddingTop: 6 }}>
          <span className="nb-label muted">{label}</span>
          <div className="stat-value">{value}</div>
          {sub && (
            <span className="muted" style={{ fontSize: 13 }}>
              {sub}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/dashboard');
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonGrid count={6} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const m = summary?.metrics || {};

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>{user.role} Workspace</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Live operational overview backed by persistent MongoDB records.
          </p>
        </div>
        <Badge status={user.role} />
      </div>

      {user.role === 'Student' && (
        <>
          <div className="grid-12">
            <StatCard label="My Bookings" value={m.myBookingsCount} accent="blue" />
            <StatCard label="Pending Review" value={m.pendingBookingsCount} accent="yellow" />
            <StatCard label="Approved Stays" value={m.approvedBookingsCount} accent="green" />
            <StatCard label="Open Complaints" value={m.openComplaintsCount} accent="red" />
            <StatCard label="Upcoming Visits" value={m.upcomingVisitsCount} accent="ink" />
            <StatCard
              label="Operational Available Beds"
              value={m.availableBedsCount}
              accent="blue"
            />
          </div>

          <Card accent="blue">
            <div className="stack-md" style={{ paddingTop: 6 }}>
              <div className="row-between">
                <h3>Recent Booking Requests</h3>
                <Link to="/hostels" className="nb-btn nb-btn-primary nb-btn-sm">
                  <BedDouble size={16} strokeWidth={2} /> Search Hostels &amp; Book
                </Link>
              </div>
              {summary.recentBookings?.length ? (
                <div className="stack-sm">
                  {summary.recentBookings.map((b) => (
                    <div
                      key={b._id}
                      className="row-between"
                      style={{
                        padding: 12,
                        border: '2px solid var(--border-color)',
                        background: 'var(--bg-canvas)',
                      }}
                    >
                      <div className="stack-sm" style={{ gap: 2 }}>
                        <strong className="mono">{b.bookingId}</strong>
                        <span>
                          {b.hostel?.hostelName} — Room {b.room?.roomNumber}, Bed {b.bed?.bedNumber}
                        </span>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {formatDate(b.startDate)} to {formatDate(b.endDate)}
                        </span>
                      </div>
                      <div className="row-wrap">
                        <Badge status={b.bookingStatus} />
                        <Link to="/bookings" className="nb-btn nb-btn-secondary nb-btn-sm">
                          Manage <ArrowRight size={14} strokeWidth={2} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No booking requests submitted yet.</p>
              )}
            </div>
          </Card>
        </>
      )}

      {user.role === 'Warden' && (
        <>
          <div className="grid-12">
            <StatCard label="Pending Booking Reviews" value={m.pendingReviewsCount} accent="yellow" />
            <StatCard label="Active Allocations" value={m.activeAllocationsCount} accent="blue" />
            <StatCard label="Checked-In Residents" value={m.checkedInCount} accent="green" />
            <StatCard label="Open Complaints" value={m.openComplaintsCount} accent="red" />
            <StatCard label="Active Visitor Passes" value={m.registeredVisitorsCount} accent="ink" />
            <StatCard label="Available Beds" value={m.availableBedsCount} accent="blue" />
          </div>

          <Card accent="yellow">
            <div className="stack-md" style={{ paddingTop: 6 }}>
              <div className="row-between">
                <h3>Pending Approval Queue</h3>
                <Link to="/bookings" className="nb-btn nb-btn-primary nb-btn-sm">
                  <CalendarCheck size={16} strokeWidth={2} /> Review Queue
                </Link>
              </div>
              {summary.pendingBookings?.length ? (
                <div className="stack-sm">
                  {summary.pendingBookings.map((b) => (
                    <div
                      key={b._id}
                      className="row-between"
                      style={{
                        padding: 12,
                        border: '2px solid var(--border-color)',
                        background: 'var(--bg-canvas)',
                      }}
                    >
                      <div>
                        <strong className="mono">{b.bookingId}</strong> — {b.student?.fullName} (
                        {b.student?.studentId})
                        <div className="muted" style={{ fontSize: 13 }}>
                          {b.hostel?.hostelName} / Room {b.room?.roomNumber} / Bed{' '}
                          {b.bed?.bedNumber} ({formatDate(b.startDate)} to {formatDate(b.endDate)})
                        </div>
                      </div>
                      <Link to="/bookings" className="nb-btn nb-btn-accent nb-btn-sm">
                        Review Request
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No pending booking requests in your queue.</p>
              )}
            </div>
          </Card>
        </>
      )}

      {user.role === 'AccountsPersonnel' && (
        <div className="grid-12">
          <StatCard label="Total Payment Records" value={m.totalPaymentRecords} accent="blue" />
          <StatCard label="Collected (Paid)" value={formatCurrencyINR(m.paidMinor)} accent="green" />
          <StatCard label="Pending Collection" value={formatCurrencyINR(m.pendingMinor)} accent="yellow" />
          <StatCard label="Failed Payments" value={m.failedCount} accent="red" />
          <StatCard label="Active Bookings" value={m.eligibleBookingsCount} accent="ink" />
          <StatCard label="Generated Reports" value={m.reportsCount} accent="blue" />
          <div className="col-12 row-wrap">
            <Link to="/payments" className="nb-btn nb-btn-primary">
              Open Payment Ledger
            </Link>
            <Link to="/reports" className="nb-btn nb-btn-secondary">
              Generate Financial Report
            </Link>
          </div>
        </div>
      )}

      {(user.role === 'Administrator' || user.role === 'HostelManagement') && (
        <>
          <div className="grid-12">
            <StatCard label="Active Hostels" value={m.hostelsCount} accent="blue" />
            <StatCard label="Total Rooms" value={m.roomsCount} accent="ink" />
            <StatCard
              label="Occupancy Rate"
              value={`${m.occupancyPct}%`}
              accent="yellow"
              sub={`${m.occupiedOrReservedBeds} of ${m.totalBeds} beds assigned`}
            />
            <StatCard label="Available Operational Beds" value={m.availableBeds} accent="green" />
            <StatCard label="Active Accounts" value={m.usersCount} accent="blue" />
            <StatCard label="Audit Events Logged" value={m.auditEventsCount} accent="red" />
          </div>
          <div className="row-wrap">
            {user.role === 'Administrator' && (
              <Link to="/admin/inventory" className="nb-btn nb-btn-primary">
                Manage Hostels, Rooms &amp; Beds
              </Link>
            )}
            <Link to="/reports" className="nb-btn nb-btn-accent">
              <ClipboardList size={16} strokeWidth={2} /> Reports Console
            </Link>
            <Link to="/audit-logs" className="nb-btn nb-btn-secondary">
              <ShieldCheck size={16} strokeWidth={2} /> Review Audit Logs
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
