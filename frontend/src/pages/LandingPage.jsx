import { useEffect, useState } from 'react';
import '../styles/landing.css';
import { useReveal } from '../hooks/useReveal';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import AssistantAvatar from '../components/AssistantAvatar';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { ToothIcon, CalendarIcon, ChatIcon } from '../components/icons';
import { resolveDoctorPhoto } from '../data/doctorPhotos';
import heroPhoto from '../assets/Top_background.jpg';
import aboutPhoto from '../assets/Third_Page.jpg';
import generalPhoto from '../assets/General_Dentistry.jpg';
import orthoPhoto from '../assets/Orthodontics.jpg';
import pediatricPhoto from '../assets/Pediatric_Dentistry.jpg';
import benefitsPhoto from '../assets/Second_Page.jpg';

const SERVICES = [
  { icon: '🪥', photo: generalPhoto, title: 'General Dentistry', text: 'Routine cleanings, restorative fillings, and preventive care to maintain a healthy smile year-round.' },
  { icon: '😁', photo: orthoPhoto, title: 'Orthodontics', text: 'Traditional braces and clear aligners for precise, lasting bite correction — for teens and adults.' },
  { icon: '👶', photo: pediatricPhoto, title: 'Pediatric Dentistry', text: 'Gentle, age-appropriate dental care designed specifically for children.' },
];

const SPECIALTIES = [
  { icon: '🩺', title: 'Endodontics', text: 'Root canal therapy and pulp care.' },
  { icon: '🦷', title: 'Periodontics', text: 'Gum disease treatment and gum health.' },
  { icon: '⚕️', title: 'Oral Surgery', text: 'Extractions, wisdom teeth, and jaw surgery.' },
];

const STEPS = [
  {
    icon: <ToothIcon />,
    title: 'Choose your dentist',
    text: 'Browse our team by department and find the dentist who suits you best.',
  },
  {
    icon: <CalendarIcon />,
    title: 'Pick a time',
    text: 'See real-time availability and book in a few clicks. Conflicts are checked automatically.',
  },
  {
    icon: <ChatIcon />,
    title: 'Get answers and reminders',
    text: 'Ask the assistant anything about the clinic, and we remind you before your visit.',
  },
];

const TICKER_ITEMS = [
  { icon: '🪥', label: 'General Dentistry' },
  { icon: '😁', label: 'Orthodontics' },
  { icon: '🩺', label: 'Endodontics' },
  { icon: '🦷', label: 'Periodontics' },
  { icon: '⚕️', label: 'Oral Surgery' },
  { icon: '👶', label: 'Pediatric Dentistry' },
];

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

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
  // The askQuestion param tells the dashboard's FloatingChatWidget to pop
  // itself open on arrival, so this CTA actually lands on an open chat
  // instead of just the dashboard with a FAB the patient has to notice.
  const ctaHref = !user ? '/register' : isStaff ? '/knowledge-base' : '/dashboard?askQuestion=1';
  const ctaLabel = user ? 'Ask a Question' : 'Create a Free Account';

  return (
    <div className="assistant-preview-card">
      <div className="assistant-preview-header">
        <AssistantAvatar size="md" />
        <div>
          <p className="assistant-preview-name">Floss Assistant</p>
          <span className="assistant-preview-status">
            <span className="assistant-preview-dot" aria-hidden="true" />
            Available now
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
  const [stepsRef, stepsVisible] = useReveal();
  const [specialtiesRef, specialtiesVisible] = useReveal();
  const [ctaRef, ctaVisible] = useReveal();
  const [quickbookRef, quickbookVisible] = useReveal();
  const [aboutRef, aboutVisible] = useReveal();
  const [servicesRef, servicesVisible] = useReveal();
  const [benefitsRef, benefitsVisible] = useReveal();
  const [teamRef, teamVisible] = useReveal();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState(null);

  useEffect(() => {
    api.get('/public/doctors').then((data) => setDoctors(data.doctors));
  }, []);
  // The rest of the page had several more CTAs hardcoded to /register
  // regardless of login state — same dead end the Quick Book bar had:
  // RedirectIfAuthed just bounces an already-logged-in visitor straight
  // to /dashboard before they ever reach whatever the link promised.
  // /doctors has no role gate, so it's a safe real destination for any
  // logged-in role, not just patients.
  const bookingHref = user ? '/doctors' : '/register';

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <PublicHeader />

      <main id="main-content">
        <header className="landing-section landing-hero">
          <div className="hero-split">
            <div className="hero-copy">
              <p className="hero-pill">
                <span className="hero-pill-dot" aria-hidden="true" />
                Online booking · Answers you can verify
              </p>
              <h1 className="hero-title">
                Your <span className="accent">Trusted Partner</span> in Dental Care
              </h1>
              <p className="hero-sub">
                Schedule appointments, connect with our dental team, and get clear, reliable answers from
                Floss Clinic's virtual assistant — all within a single, secure platform.
              </p>
              <div className="hero-actions">
                <a className="l-btn l-btn-primary l-btn-large" href={bookingHref}>
                  Book Your Visit
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h13.5M13 6l6.5 6-6.5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a className="l-btn l-btn-ghost l-btn-large" href="#services">
                  Explore Our Services
                </a>
              </div>
              <ul className="hero-chips" aria-label="What you get">
                <li>Real-time availability</li>
                <li>No double-booking</li>
                <li>Answers that cite their sources</li>
              </ul>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-frame">
                <img src={heroPhoto} alt="" className="hero-img" />
              </div>
              <div className="hero-float hero-float-booked">
                <span className="hero-float-icon">✓</span>
                <div>
                  <p className="hero-float-title">Slot confirmed</p>
                  <p className="hero-float-sub">Conflict check passed</p>
                </div>
              </div>
              <div className="hero-float hero-float-answer">
                <span className="hero-float-icon hero-float-icon-alt">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 6.5h14v9H12l-4 3.5v-3.5H5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="hero-float-title">Clinic assistant</p>
                  <p className="hero-float-sub">Every answer cites its source</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="steps-band" aria-labelledby="steps-heading">
          <div ref={stepsRef} className={`landing-section reveal${stepsVisible ? ' reveal-visible' : ''}`}>
            <div className="steps-head">
              <p className="eyebrow">How It Works</p>
              <h2 className="section-heading" id="steps-heading">
                Care in three simple steps
              </h2>
            </div>
            <ol className="steps-grid">
              {STEPS.map((step, i) => (
                <li className="step-card" key={step.title}>
                  <span className="step-num" aria-hidden="true">{i + 1}</span>
                  <div className="step-icon" aria-hidden="true">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="quickbook-band">
          <div ref={quickbookRef} className={`landing-section quickbook-section reveal${quickbookVisible ? ' reveal-visible' : ''}`}>
            <div className="quickbook-intro">
              <p className="eyebrow">Your Clinic Assistant</p>
              <h2 className="section-heading">Get Clear Answers, Instantly</h2>
              <p className="quickbook-intro-sub">
                Ask about appointment availability, insurance, our clinical team, or general dental care.
                Every answer draws from our clinic's own records whenever possible, and we're upfront
                when it doesn't.
              </p>
            </div>
            <AssistantPreviewCard user={user} />
          </div>
        </div>

        <div className="about-band">
        <section ref={aboutRef} className={`landing-section about-grid reveal${aboutVisible ? ' reveal-visible' : ''}`} aria-labelledby="about-heading">
          <div className="about-art" aria-hidden="true">
            <div className="about-frame">
              <img src={aboutPhoto} alt="" className="about-frame-img" />
            </div>
            <div className="about-float">
              <span className="about-float-icon">✓</span>
              <div>
                <p className="about-float-title">Verified answers</p>
                <p className="about-float-sub">Every reply cites its source</p>
              </div>
            </div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">About Floss Clinic</p>
            <h2 className="section-heading" id="about-heading">
              One Platform for <br /> Comprehensive Care
            </h2>
            <p>
              Floss Clinic brings together scheduling, your care team, and your treatment history in a single,
              secure platform. Our assistant draws first from our own clinical and administrative records, and
              from general dental knowledge only when it must — so you always know where an answer comes from.
              No more phone tag or outdated paperwork: everything you need to manage your care is here, and
              always current.
            </p>
            <ul className="check-list">
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> Real-time appointment scheduling with automatic conflict checks
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> A virtual assistant that cites its sources for every answer
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">✓</span> Secure, dedicated portals for patients and staff
              </li>
            </ul>
            <a className="l-btn l-btn-primary" href={bookingHref}>
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
                A Full Range of Dental Services, <br /> Tailored to You
              </h2>
              <p className="services-intro">
                From routine check-ups to specialist treatment, our team covers every stage of care.
              </p>
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
                  <span className="service-card-badge">{s.icon}</span>
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
          <div
            ref={specialtiesRef}
            className={`specialty-grid reveal-stagger${specialtiesVisible ? ' reveal-visible' : ''}`}
          >
            {SPECIALTIES.map((sp) => (
              <div className="specialty-card" key={sp.title}>
                <span className="specialty-icon" aria-hidden="true">{sp.icon}</span>
                <div>
                  <h3>{sp.title}</h3>
                  <p>{sp.text}</p>
                  <a className="service-card-link" href={bookingHref}>
                    Learn more →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>

        <div className="team-band">
        <section
          ref={teamRef}
          className={`landing-section team-section reveal${teamVisible ? ' reveal-visible' : ''}`}
          id="team"
          aria-labelledby="team-heading"
        >
          <div className="services-head">
            <div>
              <p className="eyebrow">Our Team</p>
              <h2 className="section-heading" id="team-heading">
                Meet Our Dentists
              </h2>
            </div>
          </div>
          {doctors === null ? (
            <p role="status" aria-live="polite">
              Loading our team…
            </p>
          ) : doctors.length === 0 ? (
            <p>Our team directory is being updated — check back soon.</p>
          ) : (
            <div className="team-grid">
              {doctors.map((doc) => {
                const photo = resolveDoctorPhoto(doc);
                return (
                  <div key={doc.id} className="team-card">
                    <div className="team-card-photo">
                      {photo ? (
                        <img src={photo} alt="" />
                      ) : (
                        <span className="team-card-initials">{initials(doc.fullName)}</span>
                      )}
                    </div>
                    <div className="team-card-body">
                      <h3>{doc.fullName}</h3>
                      <p className="team-card-specialty">{doc.specialty}</p>
                      <p className="team-card-dept">{doc.departmentName}</p>
                      {doc.bio && <p className="team-card-bio">{doc.bio}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </div>

        <div className="benefits-band">
        <section ref={benefitsRef} className="landing-section">
          <div className="benefits-head">
            <p className="eyebrow">Why Choose Us</p>
            <h2 className="section-heading">
              The Floss Clinic Difference: <br /> Your Path to Better Oral Health
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
                From your first appointment to your last visit, Floss Clinic keeps your care team connected and
                your questions answered.
              </p>
              <div className="stat-grid">
                <div className="stat-block">
                  <p className="stat-num">24/7</p>
                  <p className="stat-cap">Online appointment booking</p>
                </div>
                <div className="stat-block">
                  <p className="stat-num">100%</p>
                  <p className="stat-cap">Source-cited, transparent answers</p>
                </div>
                <div className="stat-block">
                  <p className="stat-num">2</p>
                  <p className="stat-cap">Dedicated care portals</p>
                </div>
              </div>
              <ul className="check-list">
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> Convenient online appointment booking
                </li>
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> Experienced, compassionate dental professionals
                </li>
                <li>
                  <span className="check-mark" aria-hidden="true">✓</span> A virtual assistant built on verified information
                </li>
              </ul>
            </div>
          </div>
        </section>
        </div>

        <section className="cta-band" aria-labelledby="cta-heading">
          <div ref={ctaRef} className={`landing-section cta-inner reveal${ctaVisible ? ' reveal-visible' : ''}`}>
            <h2 className="section-heading" id="cta-heading">
              Ready for a healthier smile?
            </h2>
            <p className="cta-sub">
              Book online, ask the assistant anything, and we will take care of the rest.
            </p>
            <a className="l-btn l-btn-light l-btn-large" href={bookingHref}>
              Book Your Visit
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h13.5M13 6l6.5 6-6.5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
