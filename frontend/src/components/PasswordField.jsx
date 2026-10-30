import { useId, useState } from 'react';

// A password input with a show/hide toggle. The visible label text is the input's accessible
// name (via aria-labelledby), so the toggle button sitting inside the label doesn't leak into it.
export default function PasswordField({ value, onChange, autoComplete, minLength, label = 'Password' }) {
  const [shown, setShown] = useState(false);
  const labelId = useId();

  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      <div className="password-wrap">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-labelledby={labelId}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {shown ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-0.4 0.8-1.2 1.9-2.3 3" />
                <path d="M6.6 7.7C4.6 9 3.3 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.5 0 2.8-0.4 4-1" />
                <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
              </>
            ) : (
              <>
                <path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </label>
  );
}
