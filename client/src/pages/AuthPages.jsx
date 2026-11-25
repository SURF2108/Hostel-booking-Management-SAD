import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';
import { BauhausMark } from '../layouts/AppLayout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/FormControls.jsx';
import { Alert, Card } from '../components/ui/Display.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Student (Aarav)', username: 'aarav.student', role: 'Student' },
  { label: 'Student (Meera)', username: 'meera.student', role: 'Student' },
  { label: 'Warden (North)', username: 'warden.north', role: 'Warden' },
  { label: 'Administrator', username: 'admin.hostel', role: 'Administrator' },
  { label: 'Accounts Desk', username: 'accounts.desk', role: 'AccountsPersonnel' },
  { label: 'Hostel Management', username: 'management.exec', role: 'HostelManagement' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (username) => {
    setIdentifier(username);
    setPassword('HostelDemo#2026');
    setError('');
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="stack-md">
          <div className="row-wrap">
            <BauhausMark size={44} />
            <div>
              <div className="mono" style={{ fontWeight: 700 }}>
                SAD ARCHITECTURE EDITION
              </div>
              <div style={{ fontSize: 13 }} className="muted">
                MERN + MongoDB Persistent Operations
              </div>
            </div>
          </div>

          <h1 style={{ marginTop: 12 }}>Hostel Booking &amp; Bed Allocation Ledger</h1>
          <p style={{ maxWidth: 520, fontSize: 16 }}>
            Unified residential accommodation workflows derived directly from the system architecture
            diagrams: availability discovery, pending booking submission, Warden approval and atomic
            bed allocation, check-in/out lifecycle, complaints, visitors, payments, audit logs, and
            reports.
          </p>
        </div>

        {/* Pure geometric Bauhaus composition (no emoji, no stock images) */}
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            maxWidth: 460,
          }}
        >
          <div
            style={{
              height: 84,
              backgroundColor: '#2454D8',
              border: '2px solid #171717',
              boxShadow: '4px 4px 0 #171717',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 10,
              color: '#FFFDF7',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            BOOKING
          </div>
          <div
            style={{
              height: 84,
              backgroundColor: '#F4C542',
              border: '2px solid #171717',
              boxShadow: '4px 4px 0 #171717',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 10,
              color: '#171717',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            ALLOCATION
          </div>
          <div
            style={{
              height: 84,
              backgroundColor: '#E94235',
              border: '2px solid #171717',
              boxShadow: '4px 4px 0 #171717',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 10,
              color: '#171717',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            GOVERNANCE
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card stack-md">
          <Card accent="blue" featured>
            <div className="stack-md" style={{ paddingTop: 6 }}>
              <div>
                <h2>Sign In</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  Authenticate as Student, Warden, Administrator, Accounts Personnel, or Hostel
                  Management.
                </p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <form onSubmit={handleSubmit} className="stack-md" noValidate>
                <Input
                  id="login-identifier"
                  label="Username or Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. aarav.student"
                  autoComplete="username"
                  required
                />
                <Input
                  id="login-password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
                <Button type="submit" disabled={submitting}>
                  <KeyRound size={17} strokeWidth={2} />
                  {submitting ? 'Verifying Credentials...' : 'Log In to Workspace'}
                </Button>
              </form>

              <div className="row-between" style={{ paddingTop: 4 }}>
                <span className="muted" style={{ fontSize: 14 }}>
                  New student?
                </span>
                <Link to="/register" className="nb-btn nb-btn-secondary nb-btn-sm">
                  <UserPlus size={15} strokeWidth={2} /> Student Registration
                </Link>
              </div>
            </div>
          </Card>

          <Card accent="yellow">
            <div className="stack-sm" style={{ paddingTop: 6 }}>
              <div className="row-between">
                <h3>Local Demo Accounts</h3>
                <span className="mono muted">Pass: HostelDemo#2026</span>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>
                Select a fictional local account to populate credentials for evaluation:
              </p>
              <div className="row-wrap">
                {DEMO_ACCOUNTS.map((acc) => (
                  <Button
                    key={acc.username}
                    variant="secondary"
                    size="sm"
                    onClick={() => fillDemo(acc.username)}
                  >
                    {acc.label} <ArrowRight size={13} strokeWidth={2} />
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    contactNumber: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed.');
      if (err.fieldErrors) setFieldErrors(err.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="stack-md">
          <div className="row-wrap">
            <BauhausMark size={44} />
            <span className="mono" style={{ fontWeight: 700 }}>
              STUDENT ENROLMENT
            </span>
          </div>
          <h1>Create Student Account</h1>
          <p style={{ maxWidth: 480 }}>
            Public registration provisions a Student account only. Staff accounts (Warden,
            Administrator, Accounts Personnel, Hostel Management) are provisioned exclusively by an
            Administrator.
          </p>
        </div>
        <div>
          <Link to="/login" className="nb-btn nb-btn-secondary">
            Back to Sign In
          </Link>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <Card accent="red" featured>
            <div className="stack-md" style={{ paddingTop: 6 }}>
              <h2>Student Registration</h2>
              {error && <Alert variant="error">{error}</Alert>}
              <form onSubmit={handleSubmit} className="stack-md" noValidate>
                <Input
                  id="reg-username"
                  label="Username"
                  value={form.username}
                  onChange={handleChange('username')}
                  error={fieldErrors.username}
                  placeholder="e.g. kavya.student"
                  required
                />
                <Input
                  id="reg-fullname"
                  label="Full Name"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  error={fieldErrors.fullName}
                  placeholder="e.g. Kavya Sharma"
                  required
                />
                <Input
                  id="reg-email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  error={fieldErrors.email}
                  placeholder="kavya@demo-hostel.edu"
                  required
                />
                <Input
                  id="reg-contact"
                  label="Contact Number"
                  value={form.contactNumber}
                  onChange={handleChange('contactNumber')}
                  error={fieldErrors.contactNumber}
                  placeholder="+91-9800100150"
                  required
                />
                <Input
                  id="reg-password"
                  label="Password (min 8 chars)"
                  type="password"
                  value={form.password}
                  onChange={handleChange('password')}
                  error={fieldErrors.password}
                  required
                />
                <Button type="submit" disabled={submitting}>
                  <UserPlus size={17} strokeWidth={2} />
                  {submitting ? 'Creating Account...' : 'Register Student Account'}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
