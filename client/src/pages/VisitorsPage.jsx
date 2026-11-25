import { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, UserPlus, XCircle } from 'lucide-react';
import { apiFetch, formatDate, formatDateTime } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function VisitorsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  const [openReg, setOpenReg] = useState(false);
  const [form, setForm] = useState({
    visitorName: '',
    contactNumber: '',
    identificationDetails: '',
    hostelId: '',
    studentId: '',
    visitDate: new Date().toISOString().slice(0, 10),
    purpose: 'Family visit',
  });
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const reqs = [apiFetch(`/visitors?${params.toString()}`), apiFetch('/hostels')];
      if (user.role === 'Warden') {
        reqs.push(apiFetch('/users?role=Student&limit=100'));
      }
      const [vRes, hRes, sRes] = await Promise.all(reqs);
      setRecords(vRes.items || []);
      setHostels(hRes.hostels || []);
      if (sRes) setStudents(sRes.items || []);
      if (hRes.hostels?.length && !form.hostelId) {
        setForm((prev) => ({
          ...prev,
          hostelId: user.assignedHostelId?._id || hRes.hostels[0]._id,
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, user.role, user.assignedHostelId, form.hostelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormErr('');
    setBusy(true);
    try {
      const payload = { ...form };
      if (user.role !== 'Warden') delete payload.studentId;
      await apiFetch('/visitors', { method: 'POST', body: payload });
      setOpenReg(false);
      setForm((prev) => ({
        ...prev,
        visitorName: '',
        contactNumber: '',
        identificationDetails: '',
        purpose: 'Family visit',
      }));
      setBanner({ variant: 'success', text: 'Visitor pass registered.' });
      await loadData();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateVisitStatus = async (id, visitStatus) => {
    setBusy(true);
    try {
      await apiFetch(`/visitors/${id}`, {
        method: 'PATCH',
        body: { visitStatus },
      });
      setBanner({ variant: 'success', text: `Visitor status updated to ${visitStatus}.` });
      await loadData();
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>{user.role === 'Student' ? 'Register Visitors' : 'Manage Visitors'}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Pre-register hostel visitors and record gate check-in / check-out logs.
          </p>
        </div>
        {['Student', 'Warden'].includes(user.role) && (
          <Button onClick={() => setOpenReg(true)}>
            <UserPlus size={16} strokeWidth={2} /> Register Visitor
          </Button>
        )}
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="yellow">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220 }}>
            <Select
              id="vis-status-filter"
              label="Visit Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Registered">Registered</option>
              <option value="CheckedIn">CheckedIn</option>
              <option value="CheckedOut">CheckedOut</option>
              <option value="Cancelled">Cancelled</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : records.length === 0 ? (
        <EmptyState
          title="No visitor records"
          description="Registered visitor passes and check-in logs appear here."
        />
      ) : (
        <Table
          headers={[
            'Pass #',
            'Visitor Details',
            'Student & Hostel',
            'Visit Date & Purpose',
            'Gate Times',
            'Status',
            'Actions',
          ]}
        >
          {records.map((r) => (
            <tr key={r._id}>
              <td className="mono">VST-{r.visitRecordId}</td>
              <td>
                <strong>{r.visitor?.visitorName}</strong>
                <div className="mono muted">{r.visitor?.contactNumber}</div>
                <div className="mono muted" style={{ fontSize: 12 }}>
                  ID: {r.visitor?.identificationDetails}
                </div>
              </td>
              <td>
                <strong>{r.student?.fullName}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.hostel?.hostelName}
                </div>
              </td>
              <td>
                <div className="mono">{formatDate(r.visitDate)}</div>
                <div style={{ fontSize: 13 }}>{r.purpose}</div>
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {r.checkInTime && <div>In: {formatDateTime(r.checkInTime)}</div>}
                {r.checkOutTime && <div>Out: {formatDateTime(r.checkOutTime)}</div>}
                {!r.checkInTime && !r.checkOutTime && <span className="muted">Not checked in</span>}
              </td>
              <td>
                <Badge status={r.visitStatus} />
              </td>
              <td>
                {user.role === 'Warden' ? (
                  <div className="row-wrap">
                    {r.visitStatus === 'Registered' && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          disabled={busy}
                          onClick={() => updateVisitStatus(r._id, 'CheckedIn')}
                        >
                          <LogIn size={14} strokeWidth={2} /> Check In
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => updateVisitStatus(r._id, 'Cancelled')}
                        >
                          <XCircle size={14} strokeWidth={2} /> Cancel
                        </Button>
                      </>
                    )}
                    {r.visitStatus === 'CheckedIn' && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => updateVisitStatus(r._id, 'CheckedOut')}
                      >
                        <LogOut size={14} strokeWidth={2} /> Check Out
                      </Button>
                    )}
                    {['CheckedOut', 'Cancelled'].includes(r.visitStatus) && (
                      <span className="muted" style={{ fontSize: 13 }}>
                        Closed
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    Tracked by Warden
                  </span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Dialog open={openReg} title="Register Visitor Pass" onClose={() => setOpenReg(false)}>
        <form onSubmit={handleRegister} className="stack-md">
          {formErr && <Alert variant="error">{formErr}</Alert>}
          <Input
            id="vis-name"
            label="Visitor Name"
            value={form.visitorName}
            onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
            required
          />
          <Input
            id="vis-contact"
            label="Contact Number"
            value={form.contactNumber}
            onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
            required
          />
          <Input
            id="vis-id"
            label="Identification Reference"
            value={form.identificationDetails}
            onChange={(e) => setForm({ ...form, identificationDetails: e.target.value })}
            placeholder="e.g. GOV-ID-4021"
            required
          />
          <Select
            id="vis-hostel"
            label="Hostel"
            value={form.hostelId}
            onChange={(e) => setForm({ ...form, hostelId: e.target.value })}
            required
          >
            <option value="">Select Hostel</option>
            {hostels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.hostelName}
              </option>
            ))}
          </Select>
          {user.role === 'Warden' && (
            <Select
              id="vis-student"
              label="Visited Student"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              required
            >
              <option value="">Select Student</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.fullName} ({s.studentId})
                </option>
              ))}
            </Select>
          )}
          <Input
            id="vis-date"
            label="Visit Date"
            type="date"
            value={form.visitDate}
            onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
            required
          />
          <Input
            id="vis-purpose"
            label="Purpose"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          />
          <div className="row-between">
            <Button variant="secondary" onClick={() => setOpenReg(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Registering...' : 'Register Visitor'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
