import { useCallback, useEffect, useState } from 'react';
import { MessageSquarePlus, Wrench } from 'lucide-react';
import { apiFetch, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Select, Textarea } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function ComplaintsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    hostelId: '',
    category: 'Maintenance',
    description: '',
  });
  const [submitErr, setSubmitErr] = useState('');

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    complaintStatus: 'InProgress',
    resolutionDetails: '',
  });
  const [resolveErr, setResolveErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const [cRes, hRes] = await Promise.all([
        apiFetch(`/complaints?${params.toString()}`),
        apiFetch('/hostels'),
      ]);
      setComplaints(cRes.items || []);
      setHostels(hRes.hostels || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setSubmitErr('');
    setBusy(true);
    try {
      const res = await apiFetch('/complaints', {
        method: 'POST',
        body: {
          hostelId: submitForm.hostelId || null,
          category: submitForm.category,
          description: submitForm.description,
        },
      });
      setSubmitOpen(false);
      setSubmitForm({ hostelId: '', category: 'Maintenance', description: '' });
      setBanner({
        variant: 'success',
        text: `Complaint ${res.complaint.complaintId} submitted.`,
      });
      await loadData();
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openResolve = (c) => {
    setResolveErr('');
    setResolveTarget(c);
    setResolveForm({
      complaintStatus: c.complaintStatus === 'Open' ? 'InProgress' : 'Resolved',
      resolutionDetails: c.resolutionDetails || '',
    });
  };

  const handleUpdateComplaint = async (e) => {
    e.preventDefault();
    if (!resolveTarget) return;
    setResolveErr('');
    setBusy(true);
    try {
      await apiFetch(`/complaints/${resolveTarget._id}`, {
        method: 'PATCH',
        body: resolveForm,
      });
      setResolveTarget(null);
      setBanner({ variant: 'success', text: `Updated ${resolveTarget.complaintId}.` });
      await loadData();
    } catch (err) {
      setResolveErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>{user.role === 'Student' ? 'My Complaints' : 'Manage Complaints'}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Submit hostel maintenance or facility complaints and track Warden resolution progress.
          </p>
        </div>
        {user.role === 'Student' && (
          <Button onClick={() => setSubmitOpen(true)}>
            <MessageSquarePlus size={16} strokeWidth={2} /> Submit Complaint
          </Button>
        )}
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="red">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220 }}>
            <Select
              id="cmp-status-filter"
              label="Complaint Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="InProgress">InProgress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No complaints found"
          description="Submitted complaints and resolution details appear here."
        />
      ) : (
        <Table
          headers={[
            'Complaint ID',
            'Student',
            'Hostel & Category',
            'Description & Resolution',
            'Submitted',
            'Status',
            'Action',
          ]}
        >
          {complaints.map((c) => (
            <tr key={c._id}>
              <td className="mono">{c.complaintId}</td>
              <td>
                <strong>{c.student?.fullName}</strong>
                <div className="mono muted">{c.student?.studentId}</div>
              </td>
              <td>
                {c.hostel?.hostelName || 'General'}
                <div>
                  <Badge tone="neutral">{c.category}</Badge>
                </div>
              </td>
              <td style={{ maxWidth: 340 }}>
                <div>{c.description}</div>
                {c.resolutionDetails && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    <strong>Resolution:</strong> {c.resolutionDetails}
                  </div>
                )}
              </td>
              <td className="mono">{formatDate(c.submissionDate)}</td>
              <td>
                <Badge status={c.complaintStatus} />
              </td>
              <td>
                {user.role === 'Warden' && c.complaintStatus !== 'Closed' ? (
                  <Button size="sm" variant="secondary" onClick={() => openResolve(c)}>
                    <Wrench size={14} strokeWidth={2} /> Update
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

      <Dialog open={submitOpen} title="Submit New Complaint" onClose={() => setSubmitOpen(false)}>
        <form onSubmit={handleSubmitComplaint} className="stack-md">
          {submitErr && <Alert variant="error">{submitErr}</Alert>}
          <Select
            id="sc-hostel"
            label="Hostel (Optional)"
            value={submitForm.hostelId}
            onChange={(e) => setSubmitForm({ ...submitForm, hostelId: e.target.value })}
          >
            <option value="">General / Campus Wide</option>
            {hostels.map((h) => (
              <option key={h._id} value={h._id}>
                {h.hostelName}
              </option>
            ))}
          </Select>
          <Select
            id="sc-cat"
            label="Category"
            value={submitForm.category}
            onChange={(e) => setSubmitForm({ ...submitForm, category: e.target.value })}
          >
            <option value="Maintenance">Maintenance</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Security">Security</option>
            <option value="Utilities">Utilities</option>
            <option value="Other">Other</option>
          </Select>
          <Textarea
            id="sc-desc"
            label="Description"
            value={submitForm.description}
            onChange={(e) => setSubmitForm({ ...submitForm, description: e.target.value })}
            placeholder="Describe location, room/bed, and issue details"
            required
          />
          <div className="row-between">
            <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(resolveTarget)}
        title={`Update ${resolveTarget?.complaintId || ''}`}
        onClose={() => setResolveTarget(null)}
      >
        {resolveTarget && (
          <form onSubmit={handleUpdateComplaint} className="stack-md">
            {resolveErr && <Alert variant="error">{resolveErr}</Alert>}
            <Select
              id="rc-status"
              label="Complaint Status"
              value={resolveForm.complaintStatus}
              onChange={(e) =>
                setResolveForm({ ...resolveForm, complaintStatus: e.target.value })
              }
            >
              {resolveTarget.complaintStatus === 'Open' && (
                <option value="InProgress">InProgress</option>
              )}
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </Select>
            <Textarea
              id="rc-details"
              label="Resolution Details"
              value={resolveForm.resolutionDetails}
              onChange={(e) =>
                setResolveForm({ ...resolveForm, resolutionDetails: e.target.value })
              }
              placeholder="Required when marking Resolved or Closed"
            />
            <div className="row-between">
              <Button variant="secondary" onClick={() => setResolveTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save Status'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
