import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';
import { api } from '../api/client';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { resolveDoctorPhoto } from '../data/doctorPhotos';

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

// Public "meet the team" page — no login required (see /api/public/doctors).
// Each card links to that dentist's own highlight page rather than into the
// booking-oriented, login-gated DoctorsPage this used to point at.
export default function TeamPage() {
  const [doctors, setDoctors] = useState(null);

  useEffect(() => {
    api.get('/public/doctors').then((data) => setDoctors(data.doctors));
  }, []);

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <PublicHeader />

      <main id="main-content">
        <div className="landing-section team-page-header">
          <p className="eyebrow">Our Team</p>
          <h1 className="section-heading">Meet Our Dentists</h1>
        </div>

        <div className="landing-section">
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
                  <Link key={doc.id} to={`/team/${doc.id}`} className="team-card">
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
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
