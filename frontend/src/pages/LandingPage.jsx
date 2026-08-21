import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/landing.css';
import { useReveal } from '../hooks/useReveal';
import { useAuth } from '../context/AuthContext';
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

export default function LandingPage() {
  const [aboutRef, aboutVisible] = useReveal();
  const [servicesRef, servicesVisible] = useReveal();
  const [benefitsRef, benefitsVisible] = useReveal();
  const { user, logout } = useAuth();

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
                  <span className="hero-cta-arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="quickbook-band">
          <div className="landing-section quickbook-section">
            <div className="quickbook-intro">
              <p className="eyebrow">Quick Booking</p>
              <h2 className="section-heading">Request an Appointment in Under a Minute</h2>
              <p className="quickbook-intro-sub">
                Tell us who you are and when works best — our team will confirm your visit shortly after.
              </p>
            </div>
            <QuickBookBar />
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
            <a className="l-btn l-btn-primary" href="/register">
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
            <a className="l-btn l-btn-ghost" href="/register">
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
                  <a className="service-card-link" href="/register">
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
