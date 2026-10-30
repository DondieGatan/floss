import { useState } from 'react';
import AuthVisual from '../components/AuthVisual';
import PasswordField from '../components/PasswordField';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { useSlowRequestNotice } from '../hooks/useSlowRequestNotice';
import logoIcon from '../assets/logo-icon.png';

export default function LoginPage() {
  const { login, completeTwoFactorLogin, resendTwoFactorEmailCode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState(null);
  // Only ever populated when no real email provider is configured (see
  // AuthContext's login()) — lets this flow stay testable locally without
  // a real inbox, same convention as ForgotPasswordPage's devResetToken.
  const [devCode, setDevCode] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);
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
        setTwoFactorMethod(result.twoFactorMethod);
        setDevCode(result.devCode || null);
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

  async function handleResendCode() {
    setError(null);
    setResendMessage(null);
    setResending(true);
    try {
      const data = await resendTwoFactorEmailCode(twoFactorToken);
      setTwoFactorToken(data.twoFactorToken);
      setDevCode(data.devCode || null);
      setResendMessage('A new code is on its way to your email.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-split">
      <AuthVisual heading={<>Welcome <em>back.</em></>} sub="Sign in to manage your appointments, connect with your care team, and get clear answers whenever you need them." />

      <div className="auth-form-col">
        <Link className="auth-back" to="/">
          ← Back to home
        </Link>
        {twoFactorToken ? (
          <form className="auth-card" onSubmit={handleCodeSubmit}>
            <h1 className="brand">
              <img src={logoIcon} alt="" className="brand-mark" />
              Floss Clinic
            </h1>
            <h2 className="auth-card-title">Two-factor verification</h2>
            <p className="brand-sub">
              {twoFactorMethod === 'email'
                ? 'Enter the 6-digit code we emailed you, or one of your recovery codes.'
                : 'Enter the 6-digit code from your authenticator app, or one of your recovery codes.'}
            </p>

            {devCode && (
              <div className="form-notice" role="status">
                No email provider is configured yet, so here's the code directly (dev only): <strong>{devCode}</strong>
              </div>
            )}
            {resendMessage && (
              <p className="form-notice" role="status">
                {resendMessage}
              </p>
            )}
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

            {twoFactorMethod === 'email' && (
              <button
                type="button"
                className="link-button"
                onClick={handleResendCode}
                disabled={resending}
                style={{ display: 'block', margin: '12px auto 0' }}
              >
                {resending ? 'Resending…' : "Didn't get it? Resend code"}
              </button>
            )}

            <p className="auth-switch">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setTwoFactorToken(null);
                  setTwoFactorMethod(null);
                  setDevCode(null);
                  setResendMessage(null);
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
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
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
