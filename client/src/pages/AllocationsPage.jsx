import { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, RotateCcw } from 'lucide-react';
import { apiFetch, formatDate, formatDateTime } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function AllocationsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('All');
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const data = await apiFetch(`/allocations?${params.toString()}`);
      setAllocations(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id, endpoint, label) => {
    setSubmitting(true);
    setBanner({ variant: '', text: '' });
    try {
      const res = await apiFetch(`/allocations/${id}/${endpoint}`, {
        method: 'POST',
        body: {},
      });
      setBanner({
        variant: 'success',
        text: `${label} succeeded for ${res.allocation.allocationId}.`,
      });
      await load();
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
    } finally {
      setSubmitting(false);
      setReleaseTarget(null);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <h1>Bed Allocations &amp; Check-In / Check-Out</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Manage active reservations, record resident check-in/check-out, and release unused beds.
        </p>
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="yellow">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220 }}>
            <Select
              id="alloc-status-filter"
              label="Allocation Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active (Awaiting Check-In)</option>
              <option value="CheckedIn">CheckedIn</option>
              <option value="CheckedOut">CheckedOut</option>
              <option value="Released">Released</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : allocations.length === 0 ? (
        <EmptyState
          title="No bed allocations found"
          description="Approved bookings create allocations automatically."
        />
      ) : (
        <Table
          headers={[
            'Allocation ID',
            'Student',
            'Hostel / Room / Bed',
            'Period',
            'Status',
            'Timestamps',
            'Actions',
          ]}
        >
          {allocations.map((a) => (
            <tr key={a._id}>
              <td className="mono">
                <strong>{a.allocationId}</strong>
                <div className="muted">{a.booking?.bookingId}</div>
              </td>
              <td>
                <strong>{a.student?.fullName}</strong>
                <div className="mono muted">{a.student?.studentId}</div>
              </td>
              <td>
                {a.hostel?.hostelName}
                <div className="muted" style={{ fontSize: 13 }}>
                  Room {a.room?.roomNumber} / Bed {a.bed?.bedNumber}
                </div>
              </td>
              <td className="mono">
                {formatDate(a.startDate)}
                <div>to {formatDate(a.endDate)}</div>
              </td>
              <td>
                <Badge status={a.allocationStatus} />
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {a.checkInTime && <div>In: {formatDateTime(a.checkInTime)}</div>}
                {a.checkOutTime && <div>Out: {formatDateTime(a.checkOutTime)}</div>}
                {a.releasedAt && <div>Rel: {formatDateTime(a.releasedAt)}</div>}
                {!a.checkInTime && !a.checkOutTime && !a.releasedAt && (
                  <span className="muted">Pending check-in</span>
                )}
              </td>
              <td>
                {user.role === 'Warden' ? (
                  <div className="row-wrap">
                    {a.allocationStatus === 'Active' && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          disabled={submitting}
                          onClick={() => runAction(a._id, 'check-in', 'Check-in')}
                        >
                          <LogIn size={14} strokeWidth={2} /> Check In
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={submitting}
                          onClick={() => setReleaseTarget(a)}
                        >
                          <RotateCcw size={14} strokeWidth={2} /> Release Bed
                        </Button>
                      </>
                    )}
                    {a.allocationStatus === 'CheckedIn' && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={submitting}
                        onClick={() => runAction(a._id, 'check-out', 'Check-out')}
                      >
                        <LogOut size={14} strokeWidth={2} /> Check Out
                      </Button>
                    )}
                    {['CheckedOut', 'Released'].includes(a.allocationStatus) && (
                      <span className="muted" style={{ fontSize: 13 }}>
                        Completed
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    Read-only
                  </span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Dialog
        open={Boolean(releaseTarget)}
        title={`Release Bed (${releaseTarget?.allocationId || ''})`}
        onClose={() => setReleaseTarget(null)}
      >
        {releaseTarget && (
          <div className="stack-md">
            <p>
              Releasing this bed cancels the approved reservation and returns Bed{' '}
              <strong>{releaseTarget.bed?.bedNumber}</strong> in Room{' '}
              <strong>{releaseTarget.room?.roomNumber}</strong> back to Available inventory.
            </p>
            <div className="row-between">
              <Button variant="secondary" onClick={() => setReleaseTarget(null)}>
                Keep Allocation
              </Button>
              <Button
                variant="danger"
                disabled={submitting}
                onClick={() => runAction(releaseTarget._id, 'release', 'Bed release')}
              >
                {submitting ? 'Releasing...' : 'Confirm Release Bed'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
