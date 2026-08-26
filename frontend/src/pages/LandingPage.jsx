import '../styles/landing.css';
import { useReveal } from '../hooks/useReveal';
import { useAuth } from '../context/AuthContext';
import AssistantAvatar from '../components/AssistantAvatar';
import logoIcon from '../assets/logo-icon.png';
import heroPhoto from '../assets/Top_background.jpg';
import aboutPhoto from '../assets/Third_Page.jpg';
import generalPhoto from '../assets/General_Dentistry.jpg';
import orthoPhoto from '../assets/Orthodontics.jpg';
import pediatricPhoto from '../assets/Pediatric_Dentistry.jpg';
import benefitsPhoto from '../assets/Second_Page.jpg';

const SERVICES = [
  { photo: generalPhoto, title: 'General Dentistry', text: 'Cleanings, fillings, and preventive care to keep your smile healthy year-round.' },
  { photo: orthoPhoto, title: 'Orthodontics', text: 'Braces and aligners for bite correction, for teens and adults alike.' },
  { photo: pediatricPhoto, title: 'Pediatric Dentistry', text: 'Gentle, friendly dental care built around kids of every age.' },
];

const TICKER_ITEMS = [
  { icon: '🪥', label: 'General Dentistry' },
  { icon: '😁', label: 'Orthodontics' },
  { icon: '🩺', label: 'Endodontics' },
  { icon: '🦷', label: 'Periodontics' },
  { icon: '⚕️', label: 'Oral Surgery' },
  { icon: '👶', label: 'Pediatric Dentistry' },
];

function TickerStrip() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">
        {items.map((item, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-item-icon">{item.icon}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Replaces the old "Quick Book" form — that always required creating an
// account before an appointment actually got booked anyway (see git
// history), so it never delivered on its own premise. This showcases the
// clinic's actual standout feature instead, which nothing else on the page
// demonstrates (elsewhere it's just a bullet point in a checklist).
function AssistantPreviewCard({ user }) {
  const isStaff = user && (user.role === 'staff' || user.role === 'admin' || user.role === 'owner');
  // Chat itself always requires an account — for patients it lives on the
  // dashboard (a floating widget, not its own page); for staff/admin it's
  // the Knowledge Base page. Anonymous visitors go create that account.
  const ctaHref = !user ? '/register' : isStaff ? '/knowledge-base' : '/dashboard';
  const ctaLabel = user ? 'Ask a Question' : 'Create a Free Account';

  return (
    <div className="assistant-preview-card">
      <div className="assistant-preview-header">
        <AssistantAvatar size="md" />
        <div>
          <p className="assistant-preview-name">Floss Assistant</p>
          <span className="assistant-preview-status">
            <span className="assistant-preview-dot" aria-hidden="true" />
            Online now
          </span>
        </div>
      </div>
      <div className="assistant-preview-chat" aria-hidden="true">
        <div className="assistant-preview-bubble assistant-preview-bubble-user">What are your Saturday hours?</div>
        <div className="assistant-preview-bubble assistant-preview-bubble-bot">
          We&apos;re open 9 AM–2 PM on Saturdays.<span className="assistant-preview-citation">[1]</span>
        </div>
      </div>
      <a className="l-btn l-btn-primary" href={ctaHref}>
        {ctaLabel}
      </a>
    </div>
  );
}

export default function LandingPage() {
  const [quickbookRef, quickbookVisible] = useReveal();
  const [aboutRef, aboutVisible] = useReveal();
  const [servicesRef, servicesVisible] = useReveal();
  const [benefitsRef, benefitsVisible] = useReveal();
  const { user, logout } = useAuth();
  // The rest of the page had several more CTAs hardcoded to /register
  // regardless of login state — same dead end the Quick Book bar had:
  // RedirectIfAuthed just bounces an already-logged-in visitor straight
  // to /dashboard before they ever reach whatever the link promised.
  // /doctors has no role gate, so it's a safe real destination for any
  // logged-in role, not just patients.
  const bookingHref = user ? '/doctors' : '/register';
  const learnMoreHref = user ? '/dashboard' : '/register';

  function handleLogout() {
    logout();
  }

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

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
                <button className="l-btn l-btn-primary l-btn-small" type="button" onClick={handleLogout}>
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

      <main id="main-content">
        <header className="landing-section landing-hero">
          <div
            className="hero-photo"
            style={{ backgroundImage: `url(${heroPhoto})` }}
          >
            <div className="hero-content">
              <h1 className="hero-title">
                Your <span className="accent">Best Dental</span> Experience Awaits
              </h1>
              <p className="hero-sub">
                Book appointments, meet our dentists, and get instant, cited answers from Floss Clinic — your
                clinic's own assistant. All in one place.
              </p>
              <div className="hero-actions">
                <a className="hero-cta" href="#services">
                  See Our Services
                  <span className="hero-cta-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12h13.5M13 6l6.5 6-6.5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="quickbook-band">
          <div ref={quickbookRef} className={`landing-section quickbook-section reveal${quickbookVisible ? ' reveal-visible' : ''}`}>
            <div className="quickbook-intro">
              <p className="eyebrow">Meet Your Assistant</p>
              <h2 className="section-heading">Get Instant, Cited Answers</h2>
              <p className="quickbook-intro-sub">
                Ask about hours, policies, insurance, or our dentists — Floss Assistant answers only from your
                clinic's own information, with a source cited every time.
              </p>
            </div>
            <AssistantPreviewCard user={user} />
          </div>
        </div>

        <div className="about-band">
        <section ref={aboutRef} className={`landing-section about-grid reveal${aboutVisible ? ' reveal-visible' : ''}`} aria-labelledby="about-heading">
          <div className="about-art" aria-hidden="true">
            <div className="about-circle-1">
              <img src={aboutPhoto} alt="" className="about-circle-img" />
            </div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About Us</p>
            <h2 className="section-heading" id="about-heading">
              One Platform for <br /> Your Whole Smile
            </h2>
            <p>
              Floss Clinic brings your dental clinic's directory, scheduling, and patient records into a single place —
              with a built-in assistant that only ever answers from your clinic's own information. No more juggling
              spreadsheets, phone tag, or outdated patient files: everything your team and your patients need lives in
              one connected, always-up-to-date platform.
            </p>
            <ul className="check-list">
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> Real-time appointment booking with conflict detection
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> An assistant that cites its sources, every time
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> Dedicated portals for patients and staff
              </li>
            </ul>
            <a className="l-btn l-btn-primary" href={learnMoreHref}>
              Learn More
            </a>
          </div>
        </section>
        </div>

        <TickerStrip />

        <div className="services-band">
        <section className="landing-section services-section" id="services" aria-labelledby="services-heading">
          <div className="services-head">
            <div>
              <p className="eyebrow">Our Services</p>
              <h2 className="section-heading" id="services-heading">
                A Wide Range of Services <br /> for Your Best Smile
              </h2>
            </div>
            <a className="l-btn l-btn-ghost" href={bookingHref}>
              Explore All Services
            </a>
          </div>
          <div ref={servicesRef} className={`services-grid reveal-stagger${servicesVisible ? ' reveal-visible' : ''}`}>
            {SERVICES.map((s) => (
              <div className="service-card" key={s.title}>
                <div className="service-card-art" aria-hidden="true">
                  <img src={s.photo} alt="" className="service-card-img" />
                </div>
                <div className="service-card-body">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <a className="service-card-link" href={bookingHref}>
                    Learn more →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>

        <div className="benefits-band">
        <section ref={benefitsRef} className="landing-section">
          <div className="benefits-head">
            <p className="eyebrow">Why Choose Us</p>
            <h2 className="section-heading">
              Benefits of Our Dental Care: <br /> Your Path to a Healthier Smile
            </h2>
          </div>
          <div className={`benefits-grid reveal${benefitsVisible ? ' reveal-visible' : ''}`}>
            <div className="benefits-art" aria-hidden="true">
              <div className="benefits-circle">
                <img src={benefitsPhoto} alt="" className="benefits-circle-img" />
              </div>
            </div>
            <div>
              <p className="benefits-lead">
                From the moment you book to the moment you leave, Floss Clinic keeps your care team connected and your
                questions answered.
              </p>
              <div className="stat-grid">
                <div className="stat-block">
                  <p className="stat-num">24/7</p>
                  <p className="stat-cap">Online booking availability</p>
                </div>
                <div className="stat-block">
                  <p className="stat-num">100%</p>
                  <p className="stat-cap">Cited assistant answers</p>
                </div>
                <div className="stat-block">
                  <p className="stat-num">2</p>
                  <p className="stat-cap">Dedicated portals, one platform</p>
                </div>
              </div>
              <ul className="check-list">
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> Easy online appointment booking
                </li>
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> Experienced and caring dentists
                </li>
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> An AI assistant that never guesses
                </li>
              </ul>
            </div>
          </div>
        </section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-section">
          <div className="footer-top">
            <div>
              <span className="landing-brand">
                <img src={logoIcon} alt="" className="landing-brand-mark" />
                Floss Clinic
              </span>
              <p className="footer-brand-sub">Your dental clinic, one place — appointments, records, and a cited assistant.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#services">Services</a>
                {user ? (
                  <a href="/dashboard">Dashboard</a>
                ) : (
                  <>
                    <a href="/register">Get Started</a>
                    <a href="/login">Sign In</a>
                  </>
                )}
              </div>
              <div className="footer-col">
                <h4>Care</h4>
                <a href={bookingHref}>Book an Appointment</a>
                <a href={bookingHref}>Meet Our Dentists</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Floss Clinic.</span>
            <span>Built with Rounds' architecture, reskinned for dental care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
