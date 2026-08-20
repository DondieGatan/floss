import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';
import { useReveal } from '../hooks/useReveal';
import heroPhoto from '../assets/Top_Page.jpg';
import aboutPhoto from '../assets/Third_Page.jpg';

const SERVICES = [
  { icon: '🦷', title: 'General Dentistry', text: 'Cleanings, fillings, and preventive care to keep your smile healthy year-round.' },
  { icon: '😁', title: 'Orthodontics', text: 'Braces and aligners for bite correction, for teens and adults alike.' },
  { icon: '👶', title: 'Pediatric Dentistry', text: 'Gentle, friendly dental care built around kids of every age.' },
];

const TICKER_ITEMS = ['General Dentistry', 'Orthodontics', 'Endodontics', 'Periodontics', 'Oral Surgery', 'Pediatric Dentistry'];

function TickerStrip() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">
        {items.map((item, i) => (
          <span className="ticker-item" key={i}>
            🦷 {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuickBookBar() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', date: '', time: '' });

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/register');
  }

  return (
    <form className="quickbook-bar" onSubmit={handleSubmit} aria-label="Quick appointment request">
      <div className="quickbook-field">
        <label htmlFor="qb-name">Name</label>
        <input id="qb-name" type="text" placeholder="Jordan Ellis" value={form.name} onChange={update('name')} />
      </div>
      <div className="quickbook-field">
        <label htmlFor="qb-phone">Phone Number</label>
        <input id="qb-phone" type="tel" placeholder="Your phone" value={form.phone} onChange={update('phone')} />
      </div>
      <div className="quickbook-field">
        <label htmlFor="qb-date">Preferred Date</label>
        <input id="qb-date" type="date" value={form.date} onChange={update('date')} />
      </div>
      <div className="quickbook-field">
        <label htmlFor="qb-time">Preferred Time</label>
        <input id="qb-time" type="time" value={form.time} onChange={update('time')} />
      </div>
      <button className="l-btn l-btn-primary" type="submit">
        Book an Appointment
      </button>
    </form>
  );
}

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

export default function LandingPage() {
  const scrolled = useScrolled();
  const [aboutRef, aboutVisible] = useReveal();
  const [servicesRef, servicesVisible] = useReveal();
  const [benefitsRef, benefitsVisible] = useReveal();

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`} aria-label="Primary">
        <span className="landing-brand">
          <span className="landing-brand-mark" aria-hidden="true">🦷</span>
          Floss Clinic
        </span>
        <div className="landing-nav-actions">
          <a className="l-btn l-btn-ghost l-btn-small" href="/login">
            Sign In
          </a>
          <a className="l-btn l-btn-primary l-btn-small" href="/register">
            Get Started
          </a>
        </div>
      </nav>

      <main id="main-content">
        <header className="landing-section landing-hero">
          <div>
            <span className="hero-badge">🦷 Top-Notch Dental Care, Just for You</span>
            <h1 className="hero-title">
              Your <span className="accent">Best Dental</span> Experience Awaits
            </h1>
            <p className="hero-sub">
              Book appointments, meet our dentists, and get instant, cited answers from Floss Clinic — your clinic's own
              assistant. All in one place.
            </p>
            <div className="hero-actions">
              <a className="l-btn l-btn-primary" href="/register">
                Get Started Free
              </a>
              <a className="l-link" href="#services">
                <span className="l-link-play" aria-hidden="true">→</span>
                See Our Services
              </a>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-blob">
              <img src={heroPhoto} alt="" className="hero-blob-img" />
            </div>
            <div className="hero-float hero-float-1">😁 Healthy Smiles</div>
            <div className="hero-float hero-float-2">💬 Cited Answers</div>
          </div>
        </header>

        <div className="landing-section">
          <QuickBookBar />
        </div>

        <section ref={aboutRef} className={`landing-section about-grid reveal${aboutVisible ? ' reveal-visible' : ''}`} aria-labelledby="about-heading">
          <div className="about-art" aria-hidden="true">
            <div className="about-sparkle about-sparkle-1">✨</div>
            <div className="about-sparkle about-sparkle-2">✨</div>
            <div className="about-circle about-circle-1">
              <img src={aboutPhoto} alt="" className="about-circle-img" />
            </div>
            <div className="about-circle about-circle-2">🦷</div>
            <div className="about-badge">✓</div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About Us</p>
            <h2 className="section-heading" id="about-heading">
              One Platform for <br /> Your Whole Smile
            </h2>
            <p>
              Floss Clinic brings your dental clinic's directory, scheduling, and patient records into a single place —
              with a built-in assistant that only ever answers from your clinic's own information.
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
            <a className="l-btn l-btn-primary" href="/register">
              Learn More
            </a>
          </div>
        </section>

        <TickerStrip />

        <section className="landing-section services-section" id="services" aria-labelledby="services-heading">
          <div className="services-head">
            <div>
              <p className="eyebrow">Our Services</p>
              <h2 className="section-heading" id="services-heading">
                A Wide Range of Services <br /> for Your Best Smile
              </h2>
            </div>
            <a className="l-btn l-btn-ghost" href="/register">
              Explore All Services
            </a>
          </div>
          <div ref={servicesRef} className={`services-grid reveal-stagger${servicesVisible ? ' reveal-visible' : ''}`}>
            {SERVICES.map((s) => (
              <div className="service-card" key={s.title}>
                <div className="service-card-art" aria-hidden="true">
                  {s.icon}
                  <span className="service-card-badge">🦷</span>
                </div>
                <div className="service-card-body">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <a className="service-card-link" href="/register">
                    Learn more →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section ref={benefitsRef} className="landing-section">
          <div className="benefits-head">
            <p className="eyebrow">Why Choose Us</p>
            <h2 className="section-heading">
              Benefits of Our Dental Care: <br /> Your Path to a Healthier Smile
            </h2>
          </div>
          <div className={`benefits-grid reveal${benefitsVisible ? ' reveal-visible' : ''}`}>
            <div className="benefits-art" aria-hidden="true">
              <div className="benefits-circle">😁</div>
            </div>
            <div>
              <p style={{ color: 'var(--l-text-muted)', fontSize: 15, lineHeight: 1.7, maxWidth: 480 }}>
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
              <a className="l-btn l-btn-primary" href="/register">
                Book an Appointment
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-section">
          <div className="footer-top">
            <div>
              <span className="landing-brand">
                <span className="landing-brand-mark" aria-hidden="true">🦷</span>
                Floss Clinic
              </span>
              <p className="footer-brand-sub">Your dental clinic, one place — appointments, records, and a cited assistant.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#services">Services</a>
                <a href="/register">Get Started</a>
                <a href="/login">Sign In</a>
              </div>
              <div className="footer-col">
                <h4>Care</h4>
                <a href="/register">Book an Appointment</a>
                <a href="/register">Meet Our Dentists</a>
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
