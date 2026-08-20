import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import heroPhoto from '../assets/Top_Page.jpg';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-form-col">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="brand">
            <span className="brand-mark">🦷</span>
            Floss Clinic
          </h1>
          <p className="brand-sub">Your dental clinic, one place — appointments, records, and a cited assistant.</p>

          {error && <div className="form-error">{error}</div>}

          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
          {waking && (
            <p className="form-notice" role="status">
              Waking up the server — this can take up to a minute on the first request after a while.
            </p>
          )}

          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/register">Sign up free</Link>
          </p>
        </form>
      </div>

      <div className="auth-visual-col" aria-hidden="true">
        <div className="auth-blob">
          <img src={heroPhoto} alt="" className="auth-blob-img" />
        </div>
        <div className="auth-float auth-float-1">😁 Healthy Smiles</div>
        <div className="auth-float auth-float-2">💬 Cited Answers</div>
      </div>
    </div>
  );
}
