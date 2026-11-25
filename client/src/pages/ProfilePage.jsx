import { useState } from 'react';
import { Save } from 'lucide-react';
import { apiFetch, formatRoleLabel } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/FormControls.jsx';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    contactNumber: user?.contactNumber || '',
    currentPassword: '',
    newPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        contactNumber: form.contactNumber,
      };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }
      const res = await apiFetch('/auth/profile', { method: 'PATCH', body: payload });
      setUser(res.user);
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <h1>Manage Profile</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Update your contact information or rotate your account password.
        </p>
      </div>

      <div className="grid-12">
        <div className="col-4">
          <Card accent="yellow">
            <div className="stack-sm" style={{ paddingTop: 6 }}>
              <div className="row-between">
                <span className="mono muted">{user.username}</span>
                <Badge status={user.role}>{formatRoleLabel(user.role)}</Badge>
              </div>
              <h3>{user.fullName}</h3>
              <div className="mono" style={{ fontSize: 13 }}>
                Code: {user.studentId || user.wardenId || user.adminId || user.employeeId || 'EXEC'}
              </div>
              {user.assignedHostelId && (
                <div style={{ fontSize: 13 }}>
                  <strong>Assigned Hostel:</strong> {user.assignedHostelId.hostelName}
                </div>
              )}
              <div>
                <Badge status={user.accountStatus} />
              </div>
            </div>
          </Card>
        </div>

        <div className="col-8">
          <Card accent="blue" featured>
            <form onSubmit={handleSubmit} className="stack-md" style={{ paddingTop: 6 }}>
              <h3>Account Details</h3>
              {error && <Alert variant="error">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Input
                id="prof-name"
                label="Full Name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
              <Input
                id="prof-email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                id="prof-contact"
                label="Contact Number"
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
              />

              <div
                style={{ borderTop: '2px solid var(--border-color)', paddingTop: 12 }}
                className="stack-md"
              >
                <h3>Change Password (Optional)</h3>
                <Input
                  id="prof-cur-pw"
                  label="Current Password"
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                />
                <Input
                  id="prof-new-pw"
                  label="New Password (min 8 chars)"
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                />
              </div>

              <div>
                <Button type="submit" disabled={saving}>
                  <Save size={16} strokeWidth={2} />
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
