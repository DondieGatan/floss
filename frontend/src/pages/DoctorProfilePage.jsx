import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/landing.css';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
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

// The "highlight page" each dentist gets from the landing page's "Meet Our
// Dentists" section — public, no login required (see
// /api/public/doctors/:id). The booking CTA still respects role: a patient
// goes straight into the booking flow for this doctor, anyone else logged
// in goes to the doctor directory (same dead-end-avoidance pattern as the
// rest of the public pages), and a logged-out visitor is sent to register
// first.
export default function DoctorProfilePage() {
  const { doctorId } = useParams();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setDoctor(null);
    setNotFound(false);
    api
      .get(`/public/doctors/${doctorId}`)
      .then((data) => setDoctor(data.doctor))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  }, [doctorId]);

  const bookingHref = !user ? '/register' : user.role === 'patient' ? `/doctors/${doctorId}/book` : '/doctors';

  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <PublicHeader />

      <main id="main-content">
        <div className="landing-section profile-band">
          <a href="/#team" className="back-link-landing">
            ← Meet the team
          </a>

          {notFound ? (
            <p>We couldn't find that dentist.</p>
          ) : doctor === null ? (
            <p role="status" aria-live="polite">
              Loading…
            </p>
          ) : (
            <div className="profile-grid">
              <div className="profile-photo">
                {resolveDoctorPhoto(doctor) ? (
                  <img src={resolveDoctorPhoto(doctor)} alt="" />
                ) : (
                  <span className="profile-photo-initials">{initials(doctor.fullName)}</span>
                )}
              </div>
              <div>
                <p className="eyebrow">{doctor.departmentName}</p>
                <h1 className="section-heading">{doctor.fullName}</h1>
                <p className="profile-specialty">{doctor.specialty}</p>
                {doctor.bio && <p className="profile-bio">{doctor.bio}</p>}
                <a className="l-btn l-btn-primary" href={bookingHref}>
                  Book with {doctor.fullName}
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
