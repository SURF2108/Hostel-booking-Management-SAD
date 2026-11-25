import { useCallback, useEffect, useState } from 'react';
import { UserCog, UserPlus } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    fullName: '',
    email: '',
    contactNumber: '',
    password: '',
    role: 'Student',
    assignedHostelId: '',
  });
  const [createErr, setCreateErr] = useState('');

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    role: '',
    accountStatus: 'Active',
    assignedHostelId: '',
  });
  const [editErr, setEditErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (roleFilter) params.set('role', roleFilter);
      if (search.trim()) params.set('search', search.trim());
      const [uRes, hRes] = await Promise.all([
        apiFetch(`/users?${params.toString()}`),
        apiFetch('/hostels?includeInactive=true'),
      ]);
      setUsers(uRes.items || []);
      setHostels(hRes.hostels || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateErr('');
    setBusy(true);
    try {
      const payload = {
        ...createForm,
        email: createForm.email.trim() || undefined,
        assignedHostelId:
          createForm.role === 'Warden' && createForm.assignedHostelId
            ? createForm.assignedHostelId
            : null,
      };
      const res = await apiFetch('/users', { method: 'POST', body: payload });
      setCreateOpen(false);
      setCreateForm({
        username: '',
        fullName: '',
        email: '',
        contactNumber: '',
        password: '',
        role: 'Student',
        assignedHostelId: '',
      });
      setBanner({
        variant: 'success',
        text: `Provisioned user ${res.user.username} (${res.user.role}).`,
      });
      await loadData();
    } catch (err) {
      setCreateErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u) => {
    setEditErr('');
    setEditUser(u);
    setEditForm({
      role: u.role,
      accountStatus: u.accountStatus,
      assignedHostelId: u.assignedHostelId?._id || '',
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditErr('');
    setBusy(true);
    try {
      await apiFetch(`/users/${editUser._id}`, {
        method: 'PATCH',
        body: {
          role: editForm.role,
          accountStatus: editForm.accountStatus,
          assignedHostelId:
            editForm.role === 'Warden' && editForm.assignedHostelId
              ? editForm.assignedHostelId
              : null,
        },
      });
      setEditUser(null);
      setBanner({ variant: 'success', text: `Updated account ${editUser.username}.` });
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
          <h1>Manage Users &amp; Roles</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Provision staff and student accounts, assign Warden hostels, and control account status.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus size={16} strokeWidth={2} /> Create Account
        </Button>
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}

      <Card accent="blue">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Input
              id="user-search"
              label="Search User"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username, name, code"
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <Select
              id="user-role-filter"
              label="Filter by Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="Student">Student</option>
              <option value="Warden">Warden</option>
              <option value="Administrator">Administrator</option>
              <option value="AccountsPersonnel">AccountsPersonnel</option>
              <option value="HostelManagement">HostelManagement</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Adjust your role filter or search." />
      ) : (
        <Table headers={['ID', 'Name & Username', 'Role', 'Identifier / Hostel', 'Status', 'Actions']}>
          {users.map((u) => (
            <tr key={u._id}>
              <td className="mono">#{u.userId}</td>
              <td>
                <strong>{u.fullName}</strong>
                <div className="mono muted">{u.username}</div>
              </td>
              <td>
                <Badge status={u.role} />
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {u.studentId || u.wardenId || u.adminId || u.employeeId || 'EXEC'}
                {u.assignedHostelId && (
                  <div className="muted">Hostel: {u.assignedHostelId.hostelName}</div>
                )}
              </td>
              <td>
                <Badge status={u.accountStatus} />
              </td>
              <td>
                <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
                  <UserCog size={14} strokeWidth={2} /> Edit Role / Status
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Dialog open={createOpen} title="Provision New User" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="stack-md">
          {createErr && <Alert variant="error">{createErr}</Alert>}
          <Input
            id="cu-username"
            label="Username"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            required
          />
          <Input
            id="cu-fullname"
            label="Full Name"
            value={createForm.fullName}
            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            required
          />
          <Input
            id="cu-email"
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          />
          <Input
            id="cu-password"
            label="Initial Password (min 8 chars)"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            required
          />
          <Select
            id="cu-role"
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
          >
            <option value="Student">Student</option>
            <option value="Warden">Warden</option>
            <option value="Administrator">Administrator</option>
            <option value="AccountsPersonnel">AccountsPersonnel</option>
            <option value="HostelManagement">HostelManagement</option>
          </Select>
          {createForm.role === 'Warden' && (
            <Select
              id="cu-hostel"
              label="Assigned Hostel (Optional)"
              value={createForm.assignedHostelId}
              onChange={(e) => setCreateForm({ ...createForm, assignedHostelId: e.target.value })}
            >
              <option value="">All Hostels (Unscoped)</option>
              {hostels.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.hostelName} ({h.hostelId})
                </option>
              ))}
            </Select>
          )}
          <div className="row-between">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editUser)}
        title={`Edit ${editUser?.username || ''}`}
        onClose={() => setEditUser(null)}
      >
        {editUser && (
          <form onSubmit={handleEdit} className="stack-md">
            {editErr && <Alert variant="error">{editErr}</Alert>}
            <Select
              id="eu-role"
              label="Role"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              <option value="Student">Student</option>
              <option value="Warden">Warden</option>
              <option value="Administrator">Administrator</option>
              <option value="AccountsPersonnel">AccountsPersonnel</option>
              <option value="HostelManagement">HostelManagement</option>
            </Select>
            <Select
              id="eu-status"
              label="Account Status"
              value={editForm.accountStatus}
              onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </Select>
            {editForm.role === 'Warden' && (
              <Select
                id="eu-hostel"
                label="Assigned Hostel"
                value={editForm.assignedHostelId}
                onChange={(e) => setEditForm({ ...editForm, assignedHostelId: e.target.value })}
              >
                <option value="">All Hostels (Unscoped)</option>
                {hostels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.hostelName} ({h.hostelId})
                  </option>
                ))}
              </Select>
            )}
            <div className="row-between">
              <Button variant="secondary" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
