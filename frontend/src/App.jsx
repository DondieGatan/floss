import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DocumentsPage from './pages/DocumentsPage';
import ChatPage from './pages/ChatPage';
import DashboardPage from './pages/DashboardPage';
import DoctorsPage from './pages/DoctorsPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage';
import ManageDirectoryPage from './pages/ManageDirectoryPage';
import AllAppointmentsPage from './pages/AllAppointmentsPage';
import AdmissionsPage from './pages/AdmissionsPage';

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

const STAFF_ROLES = ['staff', 'admin'];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />

          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/knowledge-base" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
          <Route path="/chat/:conversationId" element={<RequireAuth><ChatPage /></RequireAuth>} />

          <Route path="/doctors" element={<RequireAuth><DoctorsPage /></RequireAuth>} />
          <Route path="/doctors/:doctorId/book" element={<RequireAuth roles={['patient']}><BookAppointmentPage /></RequireAuth>} />
          <Route path="/appointments" element={<RequireAuth roles={['patient']}><MyAppointmentsPage /></RequireAuth>} />

          <Route path="/manage/directory" element={<RequireAuth roles={STAFF_ROLES}><ManageDirectoryPage /></RequireAuth>} />
          <Route path="/manage/appointments" element={<RequireAuth roles={STAFF_ROLES}><AllAppointmentsPage /></RequireAuth>} />
          <Route path="/manage/admissions" element={<RequireAuth roles={STAFF_ROLES}><AdmissionsPage /></RequireAuth>} />

          {/* Legacy Footnote URL kept working for anyone with an old bookmark. */}
          <Route path="/documents" element={<Navigate to="/knowledge-base" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
