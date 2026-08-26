import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import { api } from '../api/client';
import heroPhoto from '../assets/Login_Page_picture.jpg';
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
      <div className="auth-visual-col" aria-hidden="true" style={{ backgroundImage: `url(${heroPhoto})` }}>
        <div className="auth-visual-content">
          <h2 className="auth-visual-heading">
            Join
            <br />
            Us.
          </h2>
          <p className="auth-visual-sub">
            Create a free account to book appointments, meet our dentists, and get instant, cited answers from
            your clinic's assistant.
          </p>
        </div>
      </div>

      <div className="auth-form-col">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="brand">
            <img src={logoIcon} alt="" className="brand-mark" />
            Floss Clinic
          </h1>
          <h2 className="auth-card-title">Create Account</h2>
          <p className="brand-sub">Book appointments and chat with your clinic's assistant.</p>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <label className="field">
            <span>Full name</span>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>

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
