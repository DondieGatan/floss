import { useState } from 'react';
import AuthVisual from '../components/AuthVisual';
import PasswordField from '../components/PasswordField';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import { api } from '../api/client';
import logoIcon from '../assets/logo-icon.png';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Carried over from the landing page's Quick Book bar (see LandingPage.jsx)
  // so filling that in isn't wasted effort — phone has no field on this
  // form, so it's saved to the new patient profile directly, once
  // registration actually creates one.
  const [fullName, setFullName] = useState(searchParams.get('name') || '');
  const prefillPhone = searchParams.get('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const waking = useSlowRequestNotice(submitting);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      if (prefillPhone) {
        // Best-effort — a failure here shouldn't block a successful
        // registration, the account itself is already created.
        await api.put('/patients/me', { phone: prefillPhone }).catch(() => {});
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-split">
      <AuthVisual heading={<>Welcome to <em>Floss Clinic.</em></>} sub="Create an account to schedule appointments, connect with our dental team, and get reliable answers whenever you need them." />

      <div className="auth-form-col">
        <Link className="auth-back" to="/">
          ← Back to home
        </Link>
        <form className="auth-card" onSubmit={handleSubmit} autoComplete="off">
          <h1 className="brand">
            <img src={logoIcon} alt="" className="brand-mark" />
            Floss Clinic
          </h1>
          <h2 className="auth-card-title">Create Account</h2>
          <p className="brand-sub">Create your account to get started.</p>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <label className="field">
            <span>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            // "new-password" (not "off") is what actually stops browsers from suggesting a
            // previously-saved password here — this is a new account, not a login.
            autoComplete="new-password"
          />

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
          {waking && (
            <p className="form-notice" role="status">
              Waking up the server — this can take up to a minute on the first request after a while.
            </p>
          )}

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
