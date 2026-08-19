import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PATIENT_LINKS = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/doctors', icon: '🦷', label: 'Dentists' },
  { to: '/appointments', icon: '📅', label: 'My Appointments' },
  { to: '/knowledge-base', icon: '💬', label: 'Ask Floss' },
];

const STAFF_LINKS = [
  { to: '/manage/directory', icon: '🦷', label: 'Directory' },
  { to: '/manage/appointments', icon: '📋', label: 'All Appointments' },
  { to: '/manage/admissions', icon: '🪑', label: 'Treatment Rooms' },
  { to: '/knowledge-base', icon: '💬', label: 'Knowledge Base' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'staff' || user?.role === 'admin';

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="brand">
            <span className="brand-mark">🦷</span>
            Floss
          </span>
        </div>

        <nav className="app-nav">
          <div className="app-nav-section">{isStaff ? 'Staff' : 'Patient'}</div>
          {(isStaff ? STAFF_LINKS : PATIENT_LINKS).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="app-nav-icon">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="header-user" style={{ marginBottom: 8 }}>
            {user?.fullName}
            <br />
            <span className="role-badge">{user?.role}</span>
          </div>
          <button className="btn btn-ghost btn-small btn-block" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="app-main">{children}</div>
    </div>
  );
}
