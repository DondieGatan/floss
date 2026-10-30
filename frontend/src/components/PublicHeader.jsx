import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';

// Shared nav bar for every public (unauthenticated-reachable) page — the
// landing page and the "Meet Our Dentists" team pages. Extracted from
// LandingPage once a second page needed it, rather than duplicating it.
// The section links are absolute (/#services rather than #services) so they
// keep working from any public page, not only the landing page itself.
const SECTION_LINKS = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#team', label: 'Our Team' },
];

export default function PublicHeader() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // The floating bar gains a stronger shadow once the page moves under it.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`landing-nav${scrolled ? ' is-scrolled' : ''}`} aria-label="Primary">
      <div className="landing-nav-inner">
        <a className="landing-brand" href="/">
          <img src={logoIcon} alt="" className="landing-brand-mark" />
          <span className="landing-brand-name">Floss Clinic</span>
        </a>
        <div className="landing-nav-links">
          {SECTION_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
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
