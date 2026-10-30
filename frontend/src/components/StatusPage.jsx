import logoIcon from '../assets/logo-icon.png';

// The shared layout for the "page not found" and "something went wrong" pages. It deliberately
// uses no router hooks and a plain <a> for the brand link, so the error boundary can render it
// even when the router itself is what failed.
export default function StatusPage({ code, eyebrow, title, children, actions }) {
  return (
    <main className="status-page" id="main-content">
      <a className="status-brand" href="/">
        <img src={logoIcon} alt="" className="status-brand-mark" />
        <span>Floss Clinic</span>
      </a>
      <div className="status-card">
        <p className="status-eyebrow">{eyebrow}</p>
        <div className="status-code" aria-hidden="true">
          {code}
        </div>
        <h1 className="status-title">{title}</h1>
        <p className="status-text">{children}</p>
        <div className="status-actions">{actions}</div>
      </div>
    </main>
  );
}
