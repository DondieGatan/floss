import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';

export default function SecurityPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(null);
  const [method, setMethod] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Setup flow: which method (if any) is mid-setup, plus each method's own
  // in-progress data. totpSetupData holds the secret/QR payload; the email
  // method instead holds an opaque setupToken (see /auth/2fa/email/setup) —
  // the code it's tied to lives only in the user's inbox, never client state.
  const [setupMethod, setSetupMethod] = useState(null);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [emailSetupToken, setEmailSetupToken] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  // Disable flow.
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    api.get('/auth/2fa/status').then((data) => {
      setEnabled(data.enabled);
      setMethod(data.method);
    });
  }, []);

  function resetSetupState() {
    setSetupMethod(null);
    setTotpSetupData(null);
    setEmailSetupToken(null);
    setConfirmCode('');
    setDevCode(null);
    setError(null);
  }

  async function handleStartTotpSetup() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/setup');
      setTotpSetupData(data);
      setSetupMethod('totp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartEmailSetup() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/email/setup');
      setEmailSetupToken(data.setupToken);
      setDevCode(data.devCode || null);
      setSetupMethod('email');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmTotpSetup(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/enable', { code: confirmCode });
      setRecoveryCodes(data.recoveryCodes);
      setEnabled(true);
      setMethod('totp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmEmailSetup(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/email/enable', { setupToken: emailSetupToken, code: confirmCode });
      setRecoveryCodes(data.recoveryCodes);
      setEnabled(true);
      setMethod('email');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinishSetup() {
    resetSetupState();
    setRecoveryCodes(null);
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword });
      setEnabled(false);
      setMethod(null);
      setDisabling(false);
      setDisablePassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-body">
        <h1 className="page-title">Security</h1>
        <p className="page-subtitle">Add a second layer of protection to your account.</p>

        {error && (
          <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {enabled === null ? (
          <div className="skeleton skeleton-card" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
          </div>
        ) : recoveryCodes ? (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Save your recovery codes</h2>
            </div>
            <p className="page-subtitle">
              Two-factor authentication is now enabled. Store these codes somewhere safe — each one can be used
              once to sign in if you lose access to your{' '}
              {method === 'email' ? 'email' : 'authenticator app'}. They won't be shown again.
            </p>
            <div className="recovery-codes">
              {recoveryCodes.map((c) => (
                <code key={c} className="recovery-code">
                  {c}
                </code>
              ))}
            </div>
            <button className="btn btn-primary" type="button" onClick={handleFinishSetup} style={{ marginTop: 16 }}>
              I've saved these codes
            </button>
          </div>
        ) : setupMethod === 'totp' ? (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Set up your authenticator app</h2>
            </div>
            <p className="page-subtitle">
              Add this key to your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the
              6-digit code it generates to confirm.
            </p>
            <div className="secret-key-box">
              <code className="secret-key">{totpSetupData.secret}</code>
            </div>
            <form onSubmit={handleConfirmTotpSetup}>
              <label className="field">
                <span>6-digit code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  required
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Confirming…' : 'Confirm & enable'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={resetSetupState}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : setupMethod === 'email' ? (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Confirm your email</h2>
            </div>
            <p className="page-subtitle">
              We sent a 6-digit code to <strong>{user?.email}</strong>. Enter it below to confirm you can
              receive sign-in codes there.
            </p>
            {devCode && (
              <div className="form-notice" role="status" style={{ marginBottom: 16 }}>
                No email provider is configured yet, so here's the code directly (dev only): <strong>{devCode}</strong>
              </div>
            )}
            <form onSubmit={handleConfirmEmailSetup}>
              <label className="field">
                <span>6-digit code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  required
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Confirming…' : 'Confirm & enable'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={resetSetupState}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : enabled ? (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Two-factor authentication is on</h2>
            </div>
            <p className="page-subtitle">
              Your account is protected with {method === 'email' ? 'email codes' : 'an authenticator app'}.
            </p>
            {disabling ? (
              <form onSubmit={handleDisable}>
                <label className="field">
                  <span>Confirm your password to disable</span>
                  <input
                    type="password"
                    autoFocus
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Disabling…' : 'Disable two-factor authentication'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setDisabling(false);
                      setDisablePassword('');
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={() => setDisabling(true)}>
                Disable two-factor authentication
              </button>
            )}
          </div>
        ) : (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Two-factor authentication is off</h2>
            </div>
            <p className="page-subtitle">
              Turn it on to require a second code, in addition to your password, when signing in. Choose
              whichever is easier for you.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="button" onClick={handleStartTotpSetup} disabled={submitting}>
                {submitting ? 'Starting…' : 'Use an authenticator app'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={handleStartEmailSetup} disabled={submitting}>
                {submitting ? 'Starting…' : 'Email me a code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
