import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatusPage from '../components/StatusPage';
import { ToothIcon } from '../components/icons';

// Shown for any address the app has no page for, instead of silently bouncing the visitor home.
export default function NotFoundPage() {
  const { user } = useAuth();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Page not found — Floss Clinic';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <StatusPage
      eyebrow="Page not found"
      code={
        <>
          4
          <span className="status-tooth">
            <ToothIcon />
          </span>
          4
        </>
      }
      title="We couldn't find that page"
      actions={
        <>
          <Link className="btn btn-primary" to={user ? '/dashboard' : '/'}>
            {user ? 'Go to your dashboard' : 'Back to home'}
          </Link>
          <button className="btn btn-secondary" type="button" onClick={() => window.history.back()}>
            Go back
          </button>
        </>
      }
    >
      The link may be broken, or the page may have moved. Let&apos;s get you back on track.
    </StatusPage>
  );
}
