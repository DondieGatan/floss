import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logoIcon from '../assets/logo-icon.png';
import FloatingChatWidget from './FloatingChatWidget';
import {
  HouseIcon, ToothIcon, CalendarIcon, ChatIcon, PeopleIcon, ClipboardIcon,
  DoorIcon, ShieldIcon, ChevronIcon, LogoutIcon, SunIcon, MoonIcon, LockIcon,
} from './icons';

const COLLAPSE_KEY = 'floss_sidebar_collapsed';

const PATIENT_LINKS = [
  { to: '/dashboard', icon: <HouseIcon />, label: 'Dashboard' },
  { to: '/doctors', icon: <ToothIcon />, label: 'Dentists' },
  { to: '/appointments', icon: <CalendarIcon />, label: 'History' },
];

const MANAGEMENT_LINKS = [
  { to: '/dashboard', icon: <HouseIcon />, label: 'Dashboard' },
  { to: '/manage/directory', icon: <PeopleIcon />, label: 'Directory' },
  { to: '/manage/appointments', icon: <ClipboardIcon />, label: 'All Appointments' },
  { to: '/manage/schedule', icon: <CalendarIcon />, label: 'Schedule' },
  { to: '/manage/admissions', icon: <DoorIcon />, label: 'Treatment Rooms' },
];

const KNOWLEDGE_BASE_LINK = { to: '/knowledge-base', icon: <ChatIcon />, label: 'Knowledge Base' };
const ADMIN_LINK = { to: '/manage/users', icon: <ShieldIcon />, label: 'Team & Roles' };

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');
  const asideRef = useRef(null);
  const menuBtnRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || isOwner;
  const isStaff = user?.role === 'staff' || isAdmin;
  const navLinks = !isStaff
    ? PATIENT_LINKS
    : isOwner
    ? [...MANAGEMENT_LINKS, ADMIN_LINK]
    : isAdmin
    ? [...MANAGEMENT_LINKS, KNOWLEDGE_BASE_LINK, ADMIN_LINK]
    : [...MANAGEMENT_LINKS, KNOWLEDGE_BASE_LINK];
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

  // The drawer behaves like a modal on narrow viewports (fixed position,
  // full backdrop) — it needs the same focus discipline as any dialog:
  // focus moves in on open, returns to the trigger on close, and Tab stays
  // trapped inside while it's open rather than reaching the backdrop-
  // covered page behind it.
  useEffect(() => {
    if (mobileNavOpen) {
      previouslyFocusedRef.current = document.activeElement;
      closeBtnRef.current?.focus();
    } else if (previouslyFocusedRef.current) {
      menuBtnRef.current?.focus();
    }
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        closeMobileNav();
        return;
      }
      if (e.key !== 'Tab' || !asideRef.current) return;
      // Excludes the collapse-toggle: CSS hides it below 900px (it's
      // desktop-only functionality, irrelevant to the mobile drawer this
      // trap governs), but that's a display:none rule this querySelector
      // can't see — a real display:none button is already untabbable in
      // any actual browser, so excluding it here just makes the trap
      // agree with what a real mobile viewport would already do.
      const focusables = asideRef.current.querySelectorAll(
        'a[href], button:not([disabled]):not(.app-sidebar-collapse-toggle)'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
          ref={menuBtnRef}
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
        ref={asideRef}
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
          <button
            className="app-sidebar-close"
            type="button"
            onClick={closeMobileNav}
            aria-label="Close menu"
            ref={closeBtnRef}
          >
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
          <NavLink
            to="/security"
            onClick={closeMobileNav}
            title={collapsed ? 'Security' : undefined}
            className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
          >
            <span className="app-nav-icon" aria-hidden="true"><LockIcon /></span>
            <span className="app-sidebar-fade">Security</span>
          </NavLink>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          >
            <span className="app-nav-icon" aria-hidden="true">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
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
