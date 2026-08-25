import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';

export default function SecurityPage() {
  const [enabled, setEnabled] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Setup flow: null once a fresh secret has been issued but not yet confirmed.
  const [setupData, setSetupData] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  // Disable flow.
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    api.get('/auth/2fa/status').then((data) => setEnabled(data.enabled));
  }, []);

  async function handleStartSetup() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/setup');
      setSetupData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmSetup(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.post('/auth/2fa/enable', { code: confirmCode });
      setRecoveryCodes(data.recoveryCodes);
      setEnabled(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinishSetup() {
    setSetupData(null);
    setConfirmCode('');
    setRecoveryCodes(null);
  }

  async function handleDisable(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword });
      setEnabled(false);
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
        <p className="page-subtitle">Add a second layer of protection to your account with an authenticator app.</p>

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
              once to sign in if you lose access to your authenticator app. They won't be shown again.
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
        ) : setupData ? (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Set up your authenticator app</h2>
            </div>
            <p className="page-subtitle">
              Add this key to your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the
              6-digit code it generates to confirm.
            </p>
            <div className="secret-key-box">
              <code className="secret-key">{setupData.secret}</code>
            </div>
            <form onSubmit={handleConfirmSetup}>
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
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setSetupData(null);
                    setConfirmCode('');
                    setError(null);
                  }}
                >
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
            <p className="page-subtitle">Your account is protected with an authenticator app.</p>
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
              Turn it on to require a code from your phone in addition to your password when signing in.
            </p>
            <button className="btn btn-primary" type="button" onClick={handleStartSetup} disabled={submitting}>
              {submitting ? 'Starting…' : 'Enable two-factor authentication'}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
