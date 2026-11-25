import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, XCircle } from 'lucide-react';
import { apiFetch, formatCurrencyINR, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function BookingsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  const [detailBooking, setDetailBooking] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'approve'|'reject'|'cancel', booking }
  const [actionNote, setActionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetch(`/bookings?${params.toString()}`);
      setBookings(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const openDetails = async (id) => {
    try {
      const data = await apiFetch(`/bookings/${id}`);
      setDetailBooking(data.booking);
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
    }
  };

  const openAction = (type, booking) => {
    setActionNote('');
    setActionError('');
    setActionModal({ type, booking });
  };

  const confirmAction = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    setActing(true);
    setActionError('');
    try {
      const { type, booking } = actionModal;
      if (type === 'approve') {
        await apiFetch(`/bookings/${booking._id}/approve`, {
          method: 'POST',
          body: { decisionNote: actionNote },
        });
        setBanner({
          variant: 'success',
          text: `Booking ${booking.bookingId} approved and bed allocated.`,
        });
      } else if (type === 'reject') {
        await apiFetch(`/bookings/${booking._id}/reject`, {
          method: 'POST',
          body: { decisionNote: actionNote || 'Rejected after Warden review' },
        });
        setBanner({ variant: 'info', text: `Booking ${booking.bookingId} rejected.` });
      } else if (type === 'cancel') {
        await apiFetch(`/bookings/${booking._id}/cancel`, {
          method: 'POST',
          body: { reason: actionNote || 'Cancelled by student' },
        });
        setBanner({
          variant: 'info',
          text: `Booking ${booking.bookingId} cancelled and any active reservation released.`,
        });
      }
      setActionModal(null);
      await loadBookings();
    } catch (err) {
      setActionError(err.message || 'Operation failed.');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <h1>
          {user.role === 'Student'
            ? 'My Bookings'
            : user.role === 'Warden'
              ? 'Booking Review & Approval'
              : 'Booking Ledger'}
        </h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Track booking status transitions from Pending through Approval, Allocation, and Check-out.
        </p>
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="blue">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Input
              id="booking-search"
              label="Search Booking ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. BKG-2026"
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Select
              id="booking-status-filter"
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={loadBookings} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No booking records found"
          description="No bookings match your active filters or role scope."
        />
      ) : (
        <Table
          headers={[
            'Booking ID',
            'Student',
            'Hostel / Room / Bed',
            'Stay Period',
            'Status',
            'Allocation',
            'Actions',
          ]}
        >
          {bookings.map((b) => (
            <tr key={b._id}>
              <td className="mono">{b.bookingId}</td>
              <td>
                <strong>{b.student?.fullName}</strong>
                <div className="mono muted">{b.student?.studentId}</div>
              </td>
              <td>
                {b.hostel?.hostelName}
                <div className="muted" style={{ fontSize: 13 }}>
                  Room {b.room?.roomNumber} / Bed {b.bed?.bedNumber}
                </div>
              </td>
              <td className="mono">
                {formatDate(b.startDate)}
                <div>to {formatDate(b.endDate)}</div>
              </td>
              <td>
                <Badge status={b.bookingStatus} />
              </td>
              <td>
                {b.allocation ? (
                  <div className="stack-sm" style={{ gap: 4 }}>
                    <Badge status={b.allocation.allocationStatus} />
                    <span className="mono muted">{b.allocation.allocationId}</span>
                  </div>
                ) : (
                  <span className="muted">Not allocated</span>
                )}
              </td>
              <td>
                <div className="row-wrap">
                  <Button size="sm" variant="secondary" onClick={() => openDetails(b._id)}>
                    <Eye size={14} strokeWidth={2} /> Details
                  </Button>
                  {user.role === 'Warden' && b.bookingStatus === 'Pending' && (
                    <>
                      <Button size="sm" variant="success" onClick={() => openAction('approve', b)}>
                        <Check size={14} strokeWidth={2} /> Approve &amp; Allocate
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => openAction('reject', b)}>
                        <XCircle size={14} strokeWidth={2} /> Reject
                      </Button>
                    </>
                  )}
                  {user.role === 'Student' &&
                    ['Pending', 'Approved'].includes(b.bookingStatus) &&
                    b.allocation?.allocationStatus !== 'CheckedIn' && (
                      <Button size="sm" variant="danger" onClick={() => openAction('cancel', b)}>
                        <XCircle size={14} strokeWidth={2} /> Cancel
                      </Button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Dialog
        open={Boolean(detailBooking)}
        title={detailBooking ? `Booking ${detailBooking.bookingId}` : 'Booking Details'}
        onClose={() => setDetailBooking(null)}
        maxWidth={640}
      >
        {detailBooking && (
          <div className="stack-md">
            <div className="row-between">
              <Badge status={detailBooking.bookingStatus} />
              <span className="mono">Requested: {formatDate(detailBooking.requestDate)}</span>
            </div>

            <div
              style={{ border: '2px solid var(--border-color)', padding: 12, background: 'var(--bg-canvas)' }}
              className="stack-sm"
            >
              <div>
                <strong>Student:</strong> {detailBooking.student?.fullName} (
                {detailBooking.student?.studentId})
              </div>
              <div>
                <strong>Accommodation:</strong> {detailBooking.hostel?.hostelName} / Room{' '}
                {detailBooking.room?.roomNumber} / Bed {detailBooking.bed?.bedNumber}
              </div>
              <div>
                <strong>Dates:</strong> {formatDate(detailBooking.startDate)} to{' '}
                {formatDate(detailBooking.endDate)}
              </div>
              {detailBooking.notes && (
                <div>
                  <strong>Notes:</strong> {detailBooking.notes}
                </div>
              )}
              {detailBooking.decisionNote && (
                <div>
                  <strong>Decision Note:</strong> {detailBooking.decisionNote}
                </div>
              )}
            </div>

            {detailBooking.allocation && (
              <div style={{ border: '2px solid var(--border-color)', padding: 12 }} className="stack-sm">
                <div className="row-between">
                  <strong>Allocation {detailBooking.allocation.allocationId}</strong>
                  <Badge status={detailBooking.allocation.allocationStatus} />
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Allocated by: {detailBooking.allocation.allocatedByWarden?.fullName || 'Warden'}
                </div>
              </div>
            )}

            <div className="stack-sm">
              <strong>Linked Payment Records</strong>
              {detailBooking.payments?.length ? (
                detailBooking.payments.map((p) => (
                  <div
                    key={p._id}
                    className="row-between"
                    style={{ border: '2px solid var(--border-color)', padding: 8 }}
                  >
                    <span className="mono">{p.paymentReference}</span>
                    <span>{formatCurrencyINR(p.amountMinor)}</span>
                    <Badge status={p.paymentStatus} />
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  No payment records posted for this booking yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(actionModal)}
        title={
          actionModal?.type === 'approve'
            ? `Approve & Allocate ${actionModal.booking.bookingId}`
            : actionModal?.type === 'reject'
              ? `Reject ${actionModal.booking.bookingId}`
              : `Cancel ${actionModal?.booking?.bookingId || ''}`
        }
        onClose={() => setActionModal(null)}
      >
        {actionModal && (
          <form onSubmit={confirmAction} className="stack-md">
            <p>
              {actionModal.type === 'approve' &&
                'The system will re-verify bed availability for the booking dates inside an atomic transaction and reserve the bed.'}
              {actionModal.type === 'reject' &&
                'Rejecting sets the booking to terminal Rejected status without allocating a bed.'}
              {actionModal.type === 'cancel' &&
                'Cancelling releases any Active bed allocation back to Available inventory.'}
            </p>
            {actionError && <Alert variant="error">{actionError}</Alert>}
            <Textarea
              id="booking-action-note"
              label={actionModal.type === 'cancel' ? 'Cancellation Reason' : 'Decision Note'}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Optional note recorded in audit trail"
            />
            <div className="row-between">
              <Button variant="secondary" onClick={() => setActionModal(null)}>
                Close
              </Button>
              <Button
                type="submit"
                variant={actionModal.type === 'approve' ? 'success' : 'danger'}
                disabled={acting}
              >
                {acting ? 'Processing...' : 'Confirm Action'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
