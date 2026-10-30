import heroPhoto from '../assets/Login_Page_picture.jpg';
import logoIcon from '../assets/logo-icon.png';

// The photo panel shared by the sign-in, create-account and password-reset pages. It is purely
// decorative (aria-hidden); the way back to the home page lives in the form column, where
// keyboard and screen-reader users can reach it.
const POINTS = ['Real-time availability', 'Answers that cite their sources', 'Secure portals for patients and staff'];

export default function AuthVisual({ heading, sub }) {
  return (
    <div className="auth-visual-col" aria-hidden="true" style={{ backgroundImage: `url(${heroPhoto})` }}>
      <div className="auth-visual-brand">
        <img src={logoIcon} alt="" className="auth-visual-brand-mark" />
        <span>Floss Clinic</span>
      </div>
      <div className="auth-visual-content">
        <h2 className="auth-visual-heading">{heading}</h2>
        <p className="auth-visual-sub">{sub}</p>
        <ul className="auth-visual-points">
          {POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
