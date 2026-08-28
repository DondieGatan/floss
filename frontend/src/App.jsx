import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DocumentsPage from './pages/DocumentsPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import DoctorsPage from './pages/DoctorsPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage';
import ManageDirectoryPage from './pages/ManageDirectoryPage';
import AllAppointmentsPage from './pages/AllAppointmentsPage';
import SchedulePage from './pages/SchedulePage';
import AdmissionsPage from './pages/AdmissionsPage';
import ManageUsersPage from './pages/ManageUsersPage';
import SecurityPage from './pages/SecurityPage';

// staff/admin/owner carry broad access to the clinic's directory,
// schedules, and every patient's records — a compromised one of those
// accounts is a much bigger blast radius than a patient's own account, so
// 2FA is mandatory for them (and only encouraged, not required, for
// patients). Enforced here (redirect to Security until set up) and again
// on the backend (see enforce_two_factor_setup in app/__init__.py) for
// direct API access that bypasses this UI.
const TWO_FACTOR_REQUIRED_ROLES = ['staff', 'admin', 'owner'];

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  const mustSetUpTwoFactor = TWO_FACTOR_REQUIRED_ROLES.includes(user.role) && !user.twoFactorEnabled;
  if (mustSetUpTwoFactor && location.pathname !== '/security') {
    return <Navigate to="/security" replace />;
  }
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function Home() {
  return <LandingPage />;
}

const STAFF_ROLES = ['staff', 'admin', 'owner'];
const ADMIN_ROLES = ['admin', 'owner'];

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
          <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />
          <Route path="/reset-password" element={<RedirectIfAuthed><ResetPasswordPage /></RedirectIfAuthed>} />

          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/security" element={<RequireAuth><SecurityPage /></RequireAuth>} />
          <Route path="/knowledge-base" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
          <Route path="/chat/:conversationId" element={<RequireAuth><ChatPage /></RequireAuth>} />

          <Route path="/doctors" element={<RequireAuth><DoctorsPage /></RequireAuth>} />
          <Route path="/doctors/:doctorId/book" element={<RequireAuth roles={['patient']}><BookAppointmentPage /></RequireAuth>} />
          <Route path="/appointments" element={<RequireAuth roles={['patient']}><MyAppointmentsPage /></RequireAuth>} />

          <Route path="/manage/directory" element={<RequireAuth roles={STAFF_ROLES}><ManageDirectoryPage /></RequireAuth>} />
          <Route path="/manage/appointments" element={<RequireAuth roles={STAFF_ROLES}><AllAppointmentsPage /></RequireAuth>} />
          <Route path="/manage/schedule" element={<RequireAuth roles={STAFF_ROLES}><SchedulePage /></RequireAuth>} />
          <Route path="/manage/admissions" element={<RequireAuth roles={STAFF_ROLES}><AdmissionsPage /></RequireAuth>} />
          <Route path="/manage/users" element={<RequireAuth roles={ADMIN_ROLES}><ManageUsersPage /></RequireAuth>} />

          {/* Legacy Footnote URL kept working for anyone with an old bookmark. */}
          <Route path="/documents" element={<Navigate to="/knowledge-base" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
