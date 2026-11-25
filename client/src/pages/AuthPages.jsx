import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.jsx';
import { HostelLogo } from '../layouts/AppLayout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/FormControls.jsx';
import { Alert, Card } from '../components/ui/Display.jsx';

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

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="stack-md" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div className="row-wrap" style={{ gap: 16 }}>
            <HostelLogo size={72} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>
                CAMPUS HOUSING
              </div>
              <div style={{ fontSize: 13 }} className="muted">
                Hostel Booking &amp; Bed Management
              </div>
            </div>
          </div>

          <h1 style={{ marginTop: 8 }}>Hostel Booking &amp; Allocation Portal</h1>
          <p style={{ fontSize: 16 }}>
            Browse available hostels and rooms, submit stay requests, manage bed allocations, and
            coordinate campus residence services.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <Card accent="blue" featured>
            <div className="stack-md" style={{ paddingTop: 6 }}>
              <div>
                <h2>Sign In</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  Sign in with your campus account credentials.
                </p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              <form onSubmit={handleSubmit} className="stack-md" noValidate>
                <Input
                  id="login-identifier"
                  label="Username or Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
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
                  {submitting ? 'Signing In...' : 'Log In'}
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
        <div className="stack-md" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div className="row-wrap" style={{ gap: 16 }}>
            <HostelLogo size={72} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>
                CAMPUS HOUSING
              </div>
              <div style={{ fontSize: 13 }} className="muted">
                Student Registration
              </div>
            </div>
          </div>
          <h1>Create Student Account</h1>
          <p style={{ fontSize: 16 }}>
            Register your student profile to check hostel availability, submit booking requests, and
            manage your campus stay.
          </p>
          <div>
            <Link to="/login" className="nb-btn nb-btn-secondary">
              Back to Sign In
            </Link>
          </div>
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
                  placeholder="student@campus.edu"
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
