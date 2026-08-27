import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';

const SENSITIVE_ROLES = new Set(['admin', 'owner']);
const ALL_ROLES = ['staff', 'admin', 'owner'];

export default function ManageUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [auditLog, setAuditLog] = useState(null);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    load();
    loadAuditLog();
  }, []);

  function load() {
    api.get('/users?page=1').then((data) => {
      setUsers(data.users);
      setPage(1);
      setHasMore(data.hasMore);
    });
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const data = await api.get(`/users?page=${page + 1}`);
      setUsers((prev) => [...prev, ...data.users]);
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  function loadAuditLog() {
    api.get('/users/audit-log').then((data) => setAuditLog(data.entries));
  }

  async function handleRoleChange(userId, role) {
    setError(null);
    setPendingId(userId);
    try {
      const data = await api.patch(`/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      loadAuditLog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setPendingId(null);
    }
  }

  const isOwner = me?.role === 'owner';
  const assignableRoles = isOwner ? ALL_ROLES : ['staff'];

  return (
    <AppLayout>
      <div className="page-body page-body-wide">
        <h1 className="page-title">Team &amp; Roles</h1>
        <p className="page-subtitle">
          {isOwner
            ? 'Grant or revoke staff and admin access for any account.'
            : 'Grant or revoke staff access. Only an owner can manage admin accounts.'}
        </p>

        {error && (
          <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {users === null ? (
          <div className="skeleton skeleton-card" role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
          </div>
        ) : (
          <div className="list-col">
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const locked = !isOwner && SENSITIVE_ROLES.has(u.role);
              return (
                <div key={u.id} className="appointment-card">
                  <div className="appointment-main">
                    <span className="appointment-doctor">{u.fullName}</span>
                    <span className="appointment-time">{u.email}</span>
                  </div>
                  <div className="appointment-actions">
                    <span className="role-badge">{u.role}</span>
                    {isSelf ? (
                      <span className="page-subtitle" style={{ margin: 0 }}>
                        (you)
                      </span>
                    ) : locked ? (
                      <span className="page-subtitle" style={{ margin: 0 }}>
                        Owner only
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={pendingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        aria-label={`Change role for ${u.fullName}`}
                      >
                        {assignableRoles
                          .concat(assignableRoles.includes(u.role) ? [] : [u.role])
                          .map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <button
            className="btn btn-ghost btn-small"
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{ marginTop: 12 }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}

        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Recent activity</h2>
          </div>
          {auditLog === null ? (
            <div className="skeleton skeleton-card" role="status" aria-live="polite">
              <span className="sr-only">Loading…</span>
            </div>
          ) : auditLog.length === 0 ? (
            <p className="page-subtitle">No role changes yet.</p>
          ) : (
            <div className="list-col">
              {auditLog.map((entry) => (
                <div key={entry.id} className="appointment-card">
                  <div className="appointment-main">
                    <span className="appointment-doctor">
                      {entry.actorName} changed {entry.targetName}&apos;s role
                    </span>
                    <span className="appointment-time">
                      {entry.details} · {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
