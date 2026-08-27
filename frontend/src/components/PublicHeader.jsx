import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';

// Shared nav bar for every public (unauthenticated-reachable) page — the
// landing page and the "Meet Our Dentists" team pages. Extracted from
// LandingPage once a second page needed it, rather than duplicating it.
export default function PublicHeader() {
  const { user, logout } = useAuth();

  return (
    <nav className="landing-nav" aria-label="Primary">
      <div className="landing-nav-inner">
        <span className="landing-brand">
          <img src={logoIcon} alt="" className="landing-brand-mark" />
          Floss Clinic
        </span>
        <div className="landing-nav-actions">
          {user ? (
            <>
              <a className="l-btn l-btn-ghost l-btn-small" href="/dashboard">
                Dashboard
              </a>
              <button className="l-btn l-btn-primary l-btn-small" type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <a className="l-btn l-btn-ghost l-btn-small" href="/login">
                Sign In
              </a>
              <a className="l-btn l-btn-primary l-btn-small" href="/register">
                Get Started
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
