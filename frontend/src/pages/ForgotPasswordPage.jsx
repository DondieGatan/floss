import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import heroPhoto from '../assets/Login_Page_picture.jpg';
import logoIcon from '../assets/logo-icon.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [devResetToken, setDevResetToken] = useState(null);
  const [sent, setSent] = useState(false);
  const waking = useSlowRequestNotice(submitting);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/forgot-password', { email });
      // Only present outside of production — there's no email provider
      // wired up yet, this is what makes the flow testable without one.
      setDevResetToken(data.resetToken || null);
      setSent(true);
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
            Forgot
            <br />
            Password?
          </h2>
          <p className="auth-visual-sub">No problem — tell us the email on your account and we'll send you a reset link.</p>
        </div>
      </div>

      <div className="auth-form-col">
        <div className="auth-card">
          <h1 className="brand">
            <img src={logoIcon} alt="" className="brand-mark" />
            Floss Clinic
          </h1>
          <h2 className="auth-card-title">Reset your password</h2>

          {sent ? (
            <>
              <p className="brand-sub">
                If an account exists for <strong>{email}</strong>, a reset link has been sent to it.
              </p>
              {devResetToken && (
                <div className="form-notice" role="status">
                  <p style={{ margin: '0 0 8px' }}>
                    No email provider is configured yet, so here's the link directly (dev only):
                  </p>
                  <Link to={`/reset-password?token=${devResetToken}`}>Open reset link</Link>
                </div>
              )}
              <p className="auth-switch">
                <Link to="/login">Back to sign in</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="brand-sub">Enter the email you used to sign up.</p>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <label className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
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
