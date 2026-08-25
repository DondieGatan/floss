import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoIcon from '../assets/logo-icon.png';
import FloatingChatWidget from './FloatingChatWidget';

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ToothIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3c1.2 0 1.8.6 4 .6s2.8-.6 4-.6c2.2 0 3.5 2 3.5 5 0 4-1.2 8-2.5 10.5-.5 1-1.2 1.9-2 1.9s-1-1.6-1.3-3.3c-.3-1.7-.7-3.1-1.7-3.1s-1.4 1.4-1.7 3.1c-.3 1.7-.5 3.3-1.3 3.3s-1.5-.9-2-1.9C5.7 16 4.5 12 4.5 8c0-3 1.3-5 3.5-5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4.5 4v-4H5a1 1 0 0 1-1-1V5z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="M8.5 11h7M8.5 15h7" />
    </svg>
  );
}

function DoorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <circle cx="14.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5z" />
      <path d="M9.5 12 11 13.5 14.5 10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5l-6.5 7L14 19" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H3" />
    </svg>
  );
}

const COLLAPSE_KEY = 'floss_sidebar_collapsed';

const PATIENT_LINKS = [
  { to: '/dashboard', icon: <HouseIcon />, label: 'Dashboard' },
  { to: '/doctors', icon: <ToothIcon />, label: 'Dentists' },
  { to: '/appointments', icon: <CalendarIcon />, label: 'My Appointments' },
];

const STAFF_LINKS = [
  { to: '/manage/directory', icon: <PeopleIcon />, label: 'Directory' },
  { to: '/manage/appointments', icon: <ClipboardIcon />, label: 'All Appointments' },
  { to: '/manage/admissions', icon: <DoorIcon />, label: 'Treatment Rooms' },
  { to: '/knowledge-base', icon: <ChatIcon />, label: 'Knowledge Base' },
];

const ADMIN_LINK = { to: '/manage/users', icon: <ShieldIcon />, label: 'Team & Roles' };

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');
  const isStaff = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const navLinks = isStaff ? (isAdmin ? [...STAFF_LINKS, ADMIN_LINK] : STAFF_LINKS) : PATIENT_LINKS;
  const initials = (user?.fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, String(!c));
      return !c;
    });
  }

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') closeMobileNav();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main-content">
        Skip to content
      </a>

      <div className="app-mobile-topbar">
        <button
          className="app-mobile-menu-btn"
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <Link to="/" className="brand" title="Back to the website">
          <img src={logoIcon} alt="" className="brand-mark" />
          Floss Clinic
        </Link>
      </div>

      {mobileNavOpen && <div className="app-sidebar-backdrop" onClick={closeMobileNav} aria-hidden="true" />}

      <aside
        className={`app-sidebar${mobileNavOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}
        aria-label="Sidebar"
      >
        <button
          className="app-sidebar-collapse-toggle"
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon />
        </button>

        <div className="app-sidebar-brand">
          <Link to="/" className="brand" title="Back to the website">
            <img src={logoIcon} alt="" className="brand-mark" />
            <span className="app-sidebar-fade">Floss Clinic</span>
          </Link>
          <button className="app-sidebar-close" type="button" onClick={closeMobileNav} aria-label="Close menu">
            ✕
          </button>
        </div>

        <div className="app-sidebar-profile">
          <div className="app-sidebar-avatar" aria-hidden="true">{initials}</div>
          <div className="app-sidebar-profile-info app-sidebar-fade">
            <div className="app-sidebar-profile-name">{user?.fullName}</div>
            <span className="role-badge">{user?.role}</span>
          </div>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <div className="app-nav-section app-sidebar-fade">{isStaff ? 'Staff' : 'Patient'}</div>
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMobileNav}
              title={collapsed ? link.label : undefined}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="app-nav-icon" aria-hidden="true">{link.icon}</span>
              <span className="app-sidebar-fade">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="app-sidebar-fade">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            className="btn btn-ghost btn-small btn-block app-sidebar-logout"
            type="button"
            onClick={logout}
            title={collapsed ? 'Logout' : undefined}
          >
            <span className="app-nav-icon" aria-hidden="true"><LogoutIcon /></span>
            <span className="app-sidebar-fade">Logout</span>
          </button>
        </div>
      </aside>

      <main className="app-main" id="app-main-content" tabIndex={-1}>
        {children}
      </main>

      {!isStaff && <FloatingChatWidget />}
    </div>
  );
}
