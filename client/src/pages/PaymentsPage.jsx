import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { apiFetch, formatCurrencyINR, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function PaymentsPage() {
  const { user } = useAuth();
  const isAccounts = user.role === 'AccountsPersonnel';

  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    bookingId: '',
    amountRupees: '40000',
    paymentReference: '',
    paymentStatus: 'Pending',
    notes: '',
  });
  const [createErr, setCreateErr] = useState('');

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ paymentStatus: 'Paid', notes: '' });
  const [editErr, setEditErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const reqs = [apiFetch(`/payments?${params.toString()}`)];
      if (isAccounts) reqs.push(apiFetch('/bookings?limit=50'));
      const [pRes, bRes] = await Promise.all(reqs);
      setPayments(pRes.items || []);
      if (bRes) setBookings(bRes.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, isAccounts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateErr('');
    setBusy(true);
    try {
      const amountMinor = Math.round(Number(createForm.amountRupees) * 100);
      await apiFetch('/payments', {
        method: 'POST',
        body: {
          bookingId: createForm.bookingId,
          amountMinor,
          paymentReference: createForm.paymentReference,
          paymentStatus: createForm.paymentStatus,
          notes: createForm.notes,
        },
      });
      setCreateOpen(false);
      setCreateForm({
        bookingId: '',
        amountRupees: '40000',
        paymentReference: '',
        paymentStatus: 'Pending',
        notes: '',
      });
      setBanner({ variant: 'success', text: 'Payment record created.' });
      await loadData();
    } catch (err) {
      setCreateErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p) => {
    setEditErr('');
    setEditTarget(p);
    setEditForm({ paymentStatus: p.paymentStatus, notes: p.notes || '' });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditErr('');
    setBusy(true);
    try {
      await apiFetch(`/payments/${editTarget._id}`, {
        method: 'PATCH',
        body: editForm,
      });
      setEditTarget(null);
      setBanner({ variant: 'success', text: `Payment PAY-${editTarget.paymentId} updated.` });
      await loadData();
    } catch (err) {
      setEditErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>{isAccounts ? 'Maintain Payment Records' : 'My Payment Records'}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Administrative hostel fee records in INR linked to verified booking requests.
          </p>
        </div>
        {isAccounts && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} strokeWidth={2} /> Record Payment
          </Button>
        )}
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="green">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Input
              id="pay-search"
              label="Search Reference / Notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. TXN-DEMO"
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Select
              id="pay-status-filter"
              label="Payment Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payment records"
          description="Recorded hostel payment entries appear here."
        />
      ) : (
        <Table
          headers={[
            'Payment ID',
            'Reference',
            'Booking & Student',
            'Amount (INR)',
            'Date',
            'Status',
            'Actions',
          ]}
        >
          {payments.map((p) => (
            <tr key={p._id}>
              <td className="mono">PAY-{p.paymentId}</td>
              <td className="mono">
                <strong>{p.paymentReference}</strong>
                {p.notes && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.notes}
                  </div>
                )}
              </td>
              <td>
                <div className="mono">{p.booking?.bookingId}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {p.student?.fullName}
                </div>
              </td>
              <td className="mono">
                <strong>{formatCurrencyINR(p.amountMinor)}</strong>
              </td>
              <td className="mono">{formatDate(p.paymentDate)}</td>
              <td>
                <Badge status={p.paymentStatus} />
              </td>
              <td>
                {isAccounts && p.paymentStatus !== 'Refunded' ? (
                  <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                    <Pencil size={14} strokeWidth={2} /> Update
                  </Button>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Dialog open={createOpen} title="Create Payment Record" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="stack-md">
          {createErr && <Alert variant="error">{createErr}</Alert>}
          <Select
            id="cp-booking"
            label="Booking"
            value={createForm.bookingId}
            onChange={(e) => setCreateForm({ ...createForm, bookingId: e.target.value })}
            required
          >
            <option value="">Select Eligible Booking</option>
            {bookings
              .filter((b) => !['Rejected', 'Cancelled'].includes(b.bookingStatus))
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.bookingId} — {b.student?.fullName} ({b.bookingStatus})
                </option>
              ))}
          </Select>
          <Input
            id="cp-amount"
            label="Amount (INR)"
            type="number"
            min="1"
            step="0.01"
            value={createForm.amountRupees}
            onChange={(e) => setCreateForm({ ...createForm, amountRupees: e.target.value })}
            required
          />
          <Input
            id="cp-ref"
            label="Payment Reference / Receipt Number"
            value={createForm.paymentReference}
            onChange={(e) => setCreateForm({ ...createForm, paymentReference: e.target.value })}
            placeholder="e.g. TXN-2026-9910"
            required
          />
          <Select
            id="cp-status"
            label="Status"
            value={createForm.paymentStatus}
            onChange={(e) => setCreateForm({ ...createForm, paymentStatus: e.target.value })}
          >
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Failed">Failed</option>
          </Select>
          <Textarea
            id="cp-notes"
            label="Notes"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
          />
          <div className="row-between">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Recording...' : 'Save Payment Record'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        title={`Update Payment PAY-${editTarget?.paymentId || ''}`}
        onClose={() => setEditTarget(null)}
      >
        {editTarget && (
          <form onSubmit={handleEdit} className="stack-md">
            {editErr && <Alert variant="error">{editErr}</Alert>}
            <Select
              id="ep-status"
              label="Payment Status"
              value={editForm.paymentStatus}
              onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}
            >
              {editTarget.paymentStatus === 'Pending' && (
                <>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Failed">Failed</option>
                </>
              )}
              {editTarget.paymentStatus === 'Failed' && (
                <>
                  <option value="Failed">Failed</option>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                </>
              )}
              {editTarget.paymentStatus === 'Paid' && (
                <>
                  <option value="Paid">Paid</option>
                  <option value="Refunded">Refunded</option>
                </>
              )}
            </Select>
            <Textarea
              id="ep-notes"
              label="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
            <div className="row-between">
              <Button variant="secondary" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Updating...' : 'Update Payment'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
