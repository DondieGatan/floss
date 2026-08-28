import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import heroPhoto from '../assets/Login_Page_picture.jpg';
import logoIcon from '../assets/logo-icon.png';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const waking = useSlowRequestNotice(submitting);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
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
            Choose a<br />
            New Password.
          </h2>
          <p className="auth-visual-sub">Choose a new password to regain access to your account.</p>
        </div>
      </div>

      <div className="auth-form-col">
        <div className="auth-card">
          <h1 className="brand">
            <img src={logoIcon} alt="" className="brand-mark" />
            Floss Clinic
          </h1>
          <h2 className="auth-card-title">Set a new password</h2>

          {!token ? (
            <>
              <div className="form-error" role="alert">
                This reset link is missing its token. Request a new one below.
              </div>
              <p className="auth-switch">
                <Link to="/forgot-password">Request a new reset link</Link>
              </p>
            </>
          ) : done ? (
            <>
              <p className="brand-sub">Your password has been updated.</p>
              <Link className="btn btn-primary" to="/login" style={{ display: 'inline-block', textAlign: 'center' }}>
                Sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="brand-sub">Enter a new password below to secure your account.</p>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
              {waking && (
                <p className="form-notice" role="status">
                  Waking up the server — this can take up to a minute on the first request after a while.
                </p>
              )}

              <p className="auth-switch">
                <Link to="/login">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
