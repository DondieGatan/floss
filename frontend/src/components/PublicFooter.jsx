import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.png';

// Shared footer for every public page (see PublicHeader for why this is
// its own component). "Services" links to the landing page's anchor with
// an absolute path (/#services rather than #services) since this footer
// no longer only ever renders on the landing page itself.
export default function PublicFooter() {
  const { user } = useAuth();
  // /doctors has no role gate, so it's a safe real destination for any
  // logged-in role, not just patients.
  const bookingHref = user ? '/doctors' : '/register';

  return (
    <footer className="landing-footer">
      <div className="landing-section">
        <div className="footer-top">
          <div>
            <span className="landing-brand">
              <img src={logoIcon} alt="" className="landing-brand-mark" />
              Floss Clinic
            </span>
            <p className="footer-brand-sub">
              Comprehensive dental care, appointment scheduling, and clinical support — all in one place.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="/#services">Services</a>
              {!user && (
                <>
                  <a href="/register">Get Started</a>
                  <a href="/login">Sign In</a>
                </>
              )}
            </div>
            <div className="footer-col">
              <h4>Care</h4>
              <a href={bookingHref}>Book an Appointment</a>
              <a href="/#team">Meet Our Dentists</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Floss Clinic. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
