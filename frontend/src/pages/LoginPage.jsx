import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import heroPhoto from '../assets/Login_Page_picture.jpg';
import logoIcon from '../assets/logo-icon.png';

export default function LoginPage() {
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const waking = useSlowRequestNotice(submitting);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await completeTwoFactorLogin(twoFactorToken, code);
      navigate('/');
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
            Welcome
            <br />
            Back.
          </h2>
          <p className="auth-visual-sub">
            Sign in to manage your appointments, connect with your care team, and get clear answers
            whenever you need them.
          </p>
        </div>
      </div>

      <div className="auth-form-col">
        {twoFactorToken ? (
          <form className="auth-card" onSubmit={handleCodeSubmit}>
            <h1 className="brand">
              <img src={logoIcon} alt="" className="brand-mark" />
              Floss Clinic
            </h1>
            <h2 className="auth-card-title">Two-factor verification</h2>
            <p className="brand-sub">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <label className="field">
              <span>Authentication code</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Verifying…' : 'Verify'}
            </button>

            <p className="auth-switch">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setTwoFactorToken(null);
                  setCode('');
                  setError(null);
                }}
              >
                Back to sign in
              </button>
            </p>
          </form>
        ) : (
          <form className="auth-card" onSubmit={handlePasswordSubmit}>
            <h1 className="brand">
              <img src={logoIcon} alt="" className="brand-mark" />
              Floss Clinic
            </h1>
            <h2 className="auth-card-title">Sign In</h2>
            <p className="brand-sub">Sign in to continue managing your care.</p>

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <p className="auth-forgot">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>

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
        )}
      </div>
    </div>
  );
}
